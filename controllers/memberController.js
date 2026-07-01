const Transaction = require('../models/transaction');
const Loan = require('../models/loan');
const Notification = require('../models/notification');

const paginationParams = (req) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  return { page, limit, skip: (page - 1) * limit };
};

// @desc    Get savings balance + headline numbers
// @route   GET /api/member/savings/balance
// @access  Private (approved members)
const getSavingsBalance = async (req, res) => {
  try {
    const userId = req.user._id;

    const [totals] = await Transaction.aggregate([
      { $match: { user: userId, category: 'savings', status: 'cleared' } },
      {
        $group: {
          _id: null,
          deposits: { $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] } },
          withdrawals: { $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] } },
        },
      },
    ]);

    const deposits = totals?.deposits || 0;
    const withdrawals = totals?.withdrawals || 0;
    const balance = deposits - withdrawals;

    const lastDeposit = await Transaction.findOne({
      user: userId,
      category: 'savings',
      type: 'deposit',
      status: 'cleared',
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      balance,
      totalDeposits: deposits,
      totalWithdrawals: withdrawals,
      lastDeposit: lastDeposit
        ? { amount: lastDeposit.amount, date: lastDeposit.createdAt }
        : null,
    });
  } catch (error) {
    console.error('Get savings balance error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching savings balance' });
  }
};

// @desc    List the member's own savings transactions
// @route   GET /api/member/savings/history
// @access  Private (approved members)
const getSavingsHistory = async (req, res) => {
  try {
    const { page, limit, skip } = paginationParams(req);
    const filter = { user: req.user._id, category: 'savings' };

    const [items, total] = await Promise.all([
      Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Transaction.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      transactions: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get savings history error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching savings history' });
  }
};

// @desc    Submit a savings deposit for admin clearance
// @route   POST /api/member/savings/deposit
// @access  Private (approved members)
const requestDeposit = async (req, res) => {
  try {
    const { amount, method, note } = req.body;
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid deposit amount' });
    }

    const transaction = await Transaction.create({
      user: req.user._id,
      category: 'savings',
      type: 'deposit',
      amount: numericAmount,
      method: method || 'bank_transfer',
      note,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Deposit submitted and awaiting confirmation',
      transaction,
    });
  } catch (error) {
    console.error('Request deposit error:', error);
    res.status(500).json({ success: false, message: 'Server error submitting deposit' });
  }
};

// @desc    List the member's monthly contribution history
// @route   GET /api/member/contributions
// @access  Private (approved members)
const getContributionHistory = async (req, res) => {
  try {
    const { page, limit, skip } = paginationParams(req);
    const filter = { user: req.user._id, category: 'contribution' };

    const [items, total] = await Promise.all([
      Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Transaction.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      contributions: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get contribution history error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching contribution history' });
  }
};

// @desc    Apply for a loan
// @route   POST /api/member/loans
// @access  Private (approved members)
const applyForLoan = async (req, res) => {
  try {
    const { amount, purpose, termMonths } = req.body;
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid loan amount' });
    }
    if (!purpose || !purpose.trim()) {
      return res.status(400).json({ success: false, message: 'Tell us what the loan is for' });
    }

    const existingPending = await Loan.findOne({ user: req.user._id, status: 'pending' });
    if (existingPending) {
      return res.status(409).json({ success: false, message: 'You already have a loan application pending review' });
    }

    // Eligibility: at least 3 cleared monthly contributions
    const clearedContributions = await Transaction.countDocuments({
      user: req.user._id,
      category: 'contribution',
      status: 'cleared',
    });
    if (clearedContributions < 3) {
      return res.status(403).json({
        success: false,
        message: 'You need at least 3 cleared monthly contributions before applying for a loan',
      });
    }

    const loan = await Loan.create({
      user: req.user._id,
      amount: numericAmount,
      purpose: purpose.trim(),
      termMonths: Number(termMonths) || 3,
    });

    res.status(201).json({ success: true, message: 'Loan application submitted', loan });
  } catch (error) {
    console.error('Apply loan error:', error);
    res.status(500).json({ success: false, message: 'Server error submitting loan application' });
  }
};

// @desc    List the member's own loan applications
// @route   GET /api/member/loans
// @access  Private (approved members)
const getMyLoans = async (req, res) => {
  try {
    const loans = await Loan.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, loans });
  } catch (error) {
    console.error('Get my loans error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching loan applications' });
  }
};

// @desc    List the member's notifications
// @route   GET /api/member/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const { page, limit, skip } = paginationParams(req);
    const filter = { user: req.user._id };

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, read: false }),
    ]);

    res.status(200).json({
      success: true,
      notifications: items,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching notifications' });
  }
};

// @desc    Mark a single notification as read
// @route   PUT /api/member/notifications/:id/read
// @access  Private
const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.status(200).json({ success: true, notification });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, message: 'Server error updating notification' });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/member/notifications/read-all
// @access  Private
const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ success: false, message: 'Server error updating notifications' });
  }
};

module.exports = {
  getSavingsBalance,
  getSavingsHistory,
  requestDeposit,
  getContributionHistory,
  applyForLoan,
  getMyLoans,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};