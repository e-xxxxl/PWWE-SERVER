const crypto = require('crypto');
const Transaction = require('../models/transaction');
const User = require('../models/user');
const { initializeTransaction, verifyTransaction } = require('../utils/paystack');
const notify = require('../utils/notify');

const VALID_PURPOSES = ['shares', 'loan_repayment', 'savings', 'other', 'registration'];
const PURPOSE_LABELS = {
  shares: 'shares payment',
  loan_repayment: 'loan repayment',
  savings: 'savings deposit',
  other: 'payment',
  registration: 'registration fee',
};

// Generate unique reference
const generateReference = () => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(5).toString('hex');
  return `PWWE-${timestamp}-${random}`;
};

/**
 * Lets the frontend know whether online payment is configured, so the option
 * only appears when the server actually has a Paystack secret key.
 */
const getPaymentConfig = (req, res) => {
  const key = process.env.PAYSTACK_SECRET_KEY || '';
  res.json({
    success: true,
    paystackEnabled: /^sk_(live|test)_/.test(key),
  });
};

/**
 * Initialize an online (Paystack) payment.
 * Accepts the same purposes as a manual deposit. Registration fees are allowed
 * before admin approval; everything else needs an approved membership — the
 * same rule the manual deposit routes enforce.
 */
const initializeDeposit = async (req, res) => {
  try {
    const { amount, note } = req.body;
    const paymentPurpose = VALID_PURPOSES.includes(req.body.paymentPurpose)
      ? req.body.paymentPurpose
      : 'shares';
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (paymentPurpose !== 'registration' && user.approvalStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        message:
          user.approvalStatus === 'rejected'
            ? 'Your membership application was not approved. Contact support for details.'
            : 'Your membership is still pending admin approval',
      });
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount < 100) {
      return res.status(400).json({ success: false, message: 'Minimum payment amount is ₦100' });
    }
    if (paymentPurpose === 'other' && !note?.trim()) {
      return res.status(400).json({ success: false, message: 'Tell us what this payment is for' });
    }

    const reference = generateReference();

    // Create pending transaction in database
    const transaction = await Transaction.create({
      user: user._id,
      category: 'savings',
      type: 'deposit',
      amount: numericAmount,
      method: 'paystack',
      paymentPurpose,
      status: 'pending',
      reference,
      note: note?.trim() || undefined,
      paymentData: { gateway: 'paystack' },
    });

    // Initialize Paystack payment
    const payment = await initializeTransaction({
      email: user.email,
      amount: numericAmount,
      reference,
      metadata: {
        userId: user._id.toString(),
        transactionId: transaction._id.toString(),
        type: 'deposit',
        paymentPurpose,
        userName: user.name,
      },
    });

    if (!payment.success) {
      transaction.status = 'failed';
      transaction.note = `Payment initialization failed: ${payment.message}`.slice(0, 280);
      await transaction.save();

      return res.status(400).json({
        success: false,
        message: payment.message || 'Payment initialization failed',
      });
    }

    res.json({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        authorization_url: payment.data.authorization_url,
        access_code: payment.data.access_code,
        reference: payment.data.reference,
        transaction,
      },
    });
  } catch (error) {
    console.error('Initialize deposit error:', error);
    res.status(500).json({ success: false, message: 'Server error initializing payment' });
  }
};

/**
 * Settle a Paystack result onto a transaction. Shared by the verify endpoint
 * and the webhook so both behave identically and a payment is only ever
 * credited once (the pending -> cleared flip is atomic).
 * Returns the up-to-date transaction.
 */
const settlePayment = async (transaction, paymentData) => {
  if (transaction.status !== 'pending') return transaction;

  if (paymentData.status === 'success') {
    const expectedKobo = Math.round(transaction.amount * 100);
    if (paymentData.amount !== expectedKobo || (paymentData.currency && paymentData.currency !== 'NGN')) {
      console.error(
        `Paystack amount/currency mismatch for ${transaction.reference}: expected ${expectedKobo} NGN kobo, got ${paymentData.amount} ${paymentData.currency}`
      );
      return transaction; // leave pending for an admin to review — never credit a mismatched amount
    }

    const cleared = await Transaction.findOneAndUpdate(
      { _id: transaction._id, status: 'pending' },
      {
        status: 'cleared',
        reviewedAt: new Date(),
        paymentData: {
          gateway: 'paystack',
          gatewayReference: paymentData.reference,
          amount: paymentData.amount / 100,
          channel: paymentData.channel,
          currency: paymentData.currency,
          paidAt: paymentData.paid_at,
          customerEmail: paymentData.customer?.email,
          authorization: paymentData.authorization
            ? {
                cardType: paymentData.authorization.card_type,
                last4: paymentData.authorization.last4,
                bank: paymentData.authorization.bank,
                brand: paymentData.authorization.brand,
              }
            : null,
        },
      },
      { returnDocument: 'after' }
    );

    if (cleared) {
      const label = PURPOSE_LABELS[cleared.paymentPurpose] || 'payment';
      await notify(cleared.user, {
        title: 'Payment successful',
        message: `Your ${label} of ₦${cleared.amount.toLocaleString()} has been confirmed.`,
        type: 'success',
      });
      return cleared;
    }
    return (await Transaction.findById(transaction._id)) || transaction;
  }

  // Only a definite failure ends the transaction. 'abandoned' / 'ongoing' /
  // 'pending' mean the member may still complete payment, so stay pending.
  if (paymentData.status === 'failed' || paymentData.status === 'reversed') {
    const failed = await Transaction.findOneAndUpdate(
      { _id: transaction._id, status: 'pending' },
      {
        status: 'failed',
        note: `Payment failed: ${paymentData.gateway_response || 'Unknown error'}`.slice(0, 280),
      },
      { returnDocument: 'after' }
    );
    return failed || transaction;
  }

  return transaction;
};

/**
 * Verify an online payment (called by the frontend after checkout)
 */
const verifyDeposit = async (req, res) => {
  try {
    const { reference } = req.params;

    // Members can only verify their own payments
    const transaction = await Transaction.findOne({ reference, user: req.user._id });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.status === 'cleared') {
      return res.json({ success: true, message: 'Payment already verified', transaction });
    }
    if (transaction.status === 'failed' || transaction.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: transaction.note || 'Payment was not successful',
        transaction,
      });
    }

    const verification = await verifyTransaction(reference);
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message || 'Payment verification failed',
        transaction,
      });
    }

    const settled = await settlePayment(transaction, verification.data);

    if (settled.status === 'cleared') {
      return res.json({
        success: true,
        message: 'Payment verified successfully',
        transaction: settled,
      });
    }
    if (settled.status === 'failed') {
      return res.status(400).json({
        success: false,
        message: verification.data.gateway_response || 'Payment was not successful',
        transaction: settled,
      });
    }

    // Still pending — the frontend keeps polling for a short while
    return res.json({
      success: true,
      message: 'Payment is still being processed',
      transaction: settled,
    });
  } catch (error) {
    console.error('Verify deposit error:', error);
    res.status(500).json({ success: false, message: 'Server error verifying payment' });
  }
};

/**
 * Handle Paystack webhook (source of truth if the member closes the tab early)
 */
const handleWebhook = async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const signature = req.headers['x-paystack-signature'];
    if (!secret || !signature || !req.rawBody) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    // Paystack signs the exact bytes it sent, so hash the raw body
    const expected = crypto.createHmac('sha512', secret).update(req.rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const event = req.body;

    if (event.event === 'charge.success' || event.event === 'charge.failed') {
      const reference = event.data?.reference;
      const transaction = reference && (await Transaction.findOne({ reference }));
      if (transaction) {
        await settlePayment(transaction, event.data);
      }
    }

    // Always acknowledge a correctly signed event so Paystack stops retrying
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
};

/**
 * Get payment history for the logged-in user
 */
const getPaymentHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      user: req.user._id,
      method: 'paystack'
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('-__v');

    res.json({
      success: true,
      transactions
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching payment history'
    });
  }
};

/**
 * Get all transactions for the logged-in user
 */
const getUserTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };
    if (status) filter.status = status;
    if (type) filter.type = type;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      Transaction.countDocuments(filter)
    ]);

    res.json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching transactions'
    });
  }
};

module.exports = {
  getPaymentConfig,
  initializeDeposit,
  verifyDeposit,
  handleWebhook,
  getPaymentHistory,
  getUserTransactions
};
