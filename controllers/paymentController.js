const crypto = require('crypto');
const Transaction = require('../models/transaction');
const User = require('../models/user');
const { initializeTransaction, verifyTransaction } = require('../utils/paystack');
const notify = require('../utils/notify');

// Generate unique reference
const generateReference = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `PWWE-${timestamp}-${random}`;
};

/**
 * Initialize a deposit payment
 */
const initializeDeposit = async (req, res) => {
  try {
    const { amount, note } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!amount || amount < 100) {
      return res.status(400).json({
        success: false,
        message: 'Minimum deposit amount is ₦100'
      });
    }

    const reference = generateReference();

    // Create pending transaction in database
    const transaction = await Transaction.create({
      user: user._id,
      category: 'savings',
      type: 'deposit',
      amount: Number(amount),
      method: 'paystack',
      status: 'pending',
      reference,
      note: note || 'Deposit via Paystack',
      paymentData: {
        gateway: 'paystack'
      }
    });

    // Initialize Paystack payment
    const payment = await initializeTransaction({
      email: user.email,
      amount: Number(amount),
      reference,
      metadata: {
        userId: user._id.toString(),
        transactionId: transaction._id.toString(),
        type: 'deposit',
        userName: user.name
      }
    });

    if (!payment.success) {
      transaction.status = 'failed';
      transaction.note = `Payment initialization failed: ${payment.message}`;
      await transaction.save();
      
      return res.status(400).json({
        success: false,
        message: payment.message || 'Payment initialization failed'
      });
    }

    res.json({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        authorization_url: payment.data.authorization_url,
        access_code: payment.data.access_code,
        reference: payment.data.reference,
        transaction
      }
    });
  } catch (error) {
    console.error('Initialize deposit error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error initializing payment'
    });
  }
};

/**
 * Verify a deposit payment
 */
const verifyDeposit = async (req, res) => {
  try {
    const { reference } = req.params;

    // Find the transaction
    const transaction = await Transaction.findOne({ reference });
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // If already cleared, return success
    if (transaction.status === 'cleared') {
      return res.json({
        success: true,
        message: 'Payment already verified',
        transaction
      });
    }

    // Verify with Paystack
    const verification = await verifyTransaction(reference);
    
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message || 'Payment verification failed'
      });
    }

    const paymentData = verification.data;

    // Check if payment was successful
    if (paymentData.status === 'success') {
      // Update transaction
      transaction.status = 'cleared';
      transaction.paymentData = {
        gateway: 'paystack',
        gatewayReference: paymentData.reference,
        amount: paymentData.amount / 100,
        channel: paymentData.channel,
        currency: paymentData.currency,
        paidAt: paymentData.paid_at,
        customerEmail: paymentData.customer?.email,
        customerCode: paymentData.customer?.customer_code,
        authorization: paymentData.authorization ? {
          authorizationCode: paymentData.authorization.authorization_code,
          cardType: paymentData.authorization.card_type,
          last4: paymentData.authorization.last4,
          expMonth: paymentData.authorization.exp_month,
          expYear: paymentData.authorization.exp_year,
          bank: paymentData.authorization.bank,
          brand: paymentData.authorization.brand,
          reusable: paymentData.authorization.reusable
        } : null
      };
      await transaction.save();

      // Notify user
      await notify(transaction.user, {
        title: 'Deposit Successful',
        message: `Your deposit of ₦${transaction.amount.toLocaleString()} has been confirmed.`,
        type: 'success'
      });

      res.json({
        success: true,
        message: 'Payment verified successfully',
        transaction,
        paymentDetails: transaction.paymentData
      });
    } else {
      // Payment failed
      transaction.status = 'failed';
      transaction.note = `Payment failed: ${paymentData.gateway_response || 'Unknown error'}`;
      await transaction.save();

      res.status(400).json({
        success: false,
        message: paymentData.gateway_response || 'Payment was not successful',
        transaction
      });
    }
  } catch (error) {
    console.error('Verify deposit error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error verifying payment'
    });
  }
};

/**
 * Handle Paystack webhook
 */
const handleWebhook = async (req, res) => {
  try {
    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const event = req.body;

    // Handle different event types
    switch (event.event) {
      case 'charge.success':
        await handleSuccessfulCharge(event.data);
        break;
      
      case 'charge.failed':
        await handleFailedCharge(event.data);
        break;
      
      case 'transfer.success':
        console.log('Transfer successful:', event.data);
        break;
      
      case 'transfer.failed':
        console.log('Transfer failed:', event.data);
        break;
      
      default:
        console.log('Unhandled event:', event.event);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
};

/**
 * Handle successful charge
 */
const handleSuccessfulCharge = async (paymentData) => {
  try {
    const reference = paymentData.reference;
    const transaction = await Transaction.findOne({ reference });
    
    if (transaction && transaction.status === 'pending') {
      transaction.status = 'cleared';
      transaction.paymentData = {
        gateway: 'paystack',
        gatewayReference: paymentData.reference,
        amount: paymentData.amount / 100,
        channel: paymentData.channel,
        currency: paymentData.currency,
        paidAt: paymentData.paid_at,
        customerEmail: paymentData.customer?.email,
        customerCode: paymentData.customer?.customer_code,
        authorization: paymentData.authorization ? {
          authorizationCode: paymentData.authorization.authorization_code,
          cardType: paymentData.authorization.card_type,
          last4: paymentData.authorization.last4,
          expMonth: paymentData.authorization.exp_month,
          expYear: paymentData.authorization.exp_year,
          bank: paymentData.authorization.bank,
          brand: paymentData.authorization.brand,
          reusable: paymentData.authorization.reusable
        } : null
      };
      await transaction.save();

      // Notify user
      await notify(transaction.user, {
        title: 'Deposit Successful',
        message: `Your deposit of ₦${transaction.amount.toLocaleString()} has been confirmed.`,
        type: 'success'
      });

      console.log(`Payment verified via webhook: ${reference}`);
    }
  } catch (error) {
    console.error('Handle successful charge error:', error);
  }
};

/**
 * Handle failed charge
 */
const handleFailedCharge = async (paymentData) => {
  try {
    const reference = paymentData.reference;
    const transaction = await Transaction.findOne({ reference });
    
    if (transaction && transaction.status === 'pending') {
      transaction.status = 'failed';
      transaction.note = `Payment failed: ${paymentData.gateway_response || 'Unknown error'}`;
      await transaction.save();
    }
  } catch (error) {
    console.error('Handle failed charge error:', error);
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
  initializeDeposit,
  verifyDeposit,
  handleWebhook,
  getPaymentHistory,
  getUserTransactions
};