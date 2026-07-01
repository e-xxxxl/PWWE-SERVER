const User = require('../models/user');
const Transaction = require('../models/transaction');
const Loan = require('../models/loan');
const notify = require('../utils/notify');


// @desc    List users (paginated, searchable)
// @route   GET /api/admin/users?page=1&limit=20&search=&role=
// @access  Private/Admin
const listUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.approvalStatus) filter.approvalStatus = req.query.approvalStatus;
    if (req.query.search) {
      const search = req.query.search.trim();
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { coopId: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      users: users.map((u) => u.toJSON()),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching users' });
  }
};

// @desc    Get a single user by id
// @route   GET /api/admin/users/:id
// @access  Private/Admin
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, user: user.toJSON() });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching user' });
  }
};

// @desc    Update a user's role
// @route   PUT /api/admin/users/:id/role
// @access  Private/Super-admin
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['member', 'admin', 'super-admin'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    if (req.user._id.equals(req.params.id) && role !== 'super-admin') {
      return res.status(400).json({ success: false, message: 'You cannot demote your own account' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true, runValidators: true });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, message: 'Role updated', user: user.toJSON() });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ success: false, message: 'Server error updating role' });
  }
};

// @desc    Activate or deactivate a user account
// @route   PUT /api/admin/users/:id/status
// @access  Private/Admin
const setUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be true or false' });
    }

    if (req.user._id.equals(req.params.id)) {
      return res.status(400).json({ success: false, message: 'You cannot change your own account status' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: isActive ? 'Account activated' : 'Account deactivated',
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Set user status error:', error);
    res.status(500).json({ success: false, message: 'Server error updating account status' });
  }
};

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
// @access  Private/Super-admin
const deleteUser = async (req, res) => {
  try {
    // Remove self-delete check for file-based admins
    // if (req.user._id.equals(req.params.id)) {
    //   return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    // }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting user' });
  }
};

// @desc    Quick member/verification stats for an admin overview panel
// @route   GET /api/admin/stats
// @access  Private/Admin
const getStats = async (req, res) => {
  try {
    const [totalUsers, verifiedUsers, activeUsers, admins] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: { $in: ['admin', 'super-admin'] } }),
    ]);

    res.status(200).json({
      success: true,
      stats: { totalUsers, verifiedUsers, activeUsers, admins },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching stats' });
  }
};

// ---------------------------------------------------------------------------
// Member Approval
// ---------------------------------------------------------------------------

// @desc    List members awaiting approval
// @route   GET /api/admin/members/pending
// @access  Private/Admin
const listPendingMembers = async (req, res) => {
  try {
    const { page, limit, skip } = (() => {
      const p = Math.max(parseInt(req.query.page) || 1, 1);
      const l = Math.min(parseInt(req.query.limit) || 20, 100);
      return { page: p, limit: l, skip: (p - 1) * l };
    })();

    const filter = { approvalStatus: 'pending' };
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      users: users.map((u) => u.toJSON()),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('List pending members error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching pending members' });
  }
};

// @desc    Approve a pending member
// @route   PUT /api/admin/members/:id/approve
// @access  Private/Admin
const approveMember = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.approvalStatus === 'approved') {
      return res.status(400).json({ success: false, message: 'Member is already approved' });
    }

    user.approvalStatus = 'approved';
    // Change req.user._id to req.admin._id (since we don't have _id for file-based admins)
    user.approvedBy = req.admin._id; // Use admin email as identifier
    user.approvedAt = new Date();
    user.rejectionReason = undefined;
    await user.save({ validateBeforeSave: false });

    await notify(user._id, {
      title: 'Membership approved',
      message: 'Your PWWE membership has been approved. You now have full access to savings and loans.',
      type: 'success',
    });

    res.status(200).json({ success: true, message: 'Member approved', user: user.toJSON() });
  } catch (error) {
    console.error('Approve member error:', error);
    res.status(500).json({ success: false, message: 'Server error approving member' });
  }
};

// @desc    Reject a pending member
// @route   PUT /api/admin/members/:id/reject
// @access  Private/Admin
const rejectMember = async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.approvalStatus = 'rejected';
    user.approvedBy = req.admin._id; // Changed from req.user._id
    user.approvedAt = new Date();
    user.rejectionReason = reason || 'Did not meet membership criteria';
    await user.save({ validateBeforeSave: false });

    await notify(user._id, {
      title: 'Membership application declined',
      message: user.rejectionReason,
      type: 'warning',
    });

    res.status(200).json({ success: true, message: 'Member rejected', user: user.toJSON() });
  } catch (error) {
    console.error('Reject member error:', error);
    res.status(500).json({ success: false, message: 'Server error rejecting member' });
  }
};

// ---------------------------------------------------------------------------
// Savings & Contribution Management
// ---------------------------------------------------------------------------

// @desc    List transactions across all members (filter by status/category/user)
// @route   GET /api/admin/transactions?status=pending&category=savings&user=...
// @access  Private/Admin
const listTransactions = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.user) filter.user = req.query.user;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate('user', 'name email coopId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('List transactions error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching transactions' });
  }
};

// @desc    Manually record a transaction on behalf of a member (e.g. cash contribution)
// @route   POST /api/admin/transactions
// @access  Private/Admin
const createTransaction = async (req, res) => {
  try {
    const { userId, category, type, amount, method, note, status } = req.body;

    const numericAmount = Number(amount);
    if (!userId || !numericAmount || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'A member and a valid amount are required' });
    }

    const member = await User.findById(userId);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const transaction = await Transaction.create({
      user: userId,
      category: category || 'savings',
      type: type || 'deposit',
      amount: numericAmount,
      method: method || 'cash',
      note,
      status: status === 'cleared' ? 'cleared' : 'pending',
      recordedBy: req.admin._id, // Changed from req.user._id
      reviewedBy: status === 'cleared' ? req.admin._id : undefined, // Changed from req.user._id
      reviewedAt: status === 'cleared' ? new Date() : undefined,
    });

    if (transaction.status === 'cleared') {
      await notify(userId, {
        title: transaction.category === 'savings' ? 'Deposit recorded' : 'Contribution recorded',
        message: `₦${numericAmount.toLocaleString()} was recorded to your ${transaction.category} account.`,
        type: 'success',
      });
    }

    res.status(201).json({ success: true, message: 'Transaction recorded', transaction });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ success: false, message: 'Server error recording transaction' });
  }
};

// @desc    Clear (approve) a pending transaction
// @route   PUT /api/admin/transactions/:id/clear
// @access  Private/Admin
const clearTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    if (transaction.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Transaction is already ${transaction.status}` });
    }

    transaction.status = 'cleared';
    transaction.reviewedBy = req.admin._id; // Changed from req.user._id
    transaction.reviewedAt = new Date();
    await transaction.save();

    await notify(transaction.user, {
      title: transaction.category === 'savings' ? 'Deposit cleared' : 'Contribution cleared',
      message: `Your ${transaction.category} ${transaction.type} of ₦${transaction.amount.toLocaleString()} has been confirmed.`,
      type: 'success',
    });

    res.status(200).json({ success: true, message: 'Transaction cleared', transaction });
  } catch (error) {
    console.error('Clear transaction error:', error);
    res.status(500).json({ success: false, message: 'Server error clearing transaction' });
  }
};

// @desc    Reject a pending transaction
// @route   PUT /api/admin/transactions/:id/reject
// @access  Private/Admin
const rejectTransaction = async (req, res) => {
  try {
    const { reason } = req.body;
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    if (transaction.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Transaction is already ${transaction.status}` });
    }

    transaction.status = 'rejected';
    transaction.reviewedBy = req.admin._id; // Changed from req.user._id
    transaction.reviewedAt = new Date();
    transaction.rejectionReason = reason || 'Could not be verified';
    await transaction.save();

    await notify(transaction.user, {
      title: 'Transaction rejected',
      message: `Your ${transaction.category} ${transaction.type} of ₦${transaction.amount.toLocaleString()} was rejected: ${transaction.rejectionReason}`,
      type: 'warning',
    });

    res.status(200).json({ success: true, message: 'Transaction rejected', transaction });
  } catch (error) {
    console.error('Reject transaction error:', error);
    res.status(500).json({ success: false, message: 'Server error rejecting transaction' });
  }
};

// ---------------------------------------------------------------------------
// Loan Approval
// ---------------------------------------------------------------------------

// @desc    List loan applications (filter by status)
// @route   GET /api/admin/loans?status=pending
// @access  Private/Admin
const listLoans = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const [loans, total] = await Promise.all([
      Loan.find(filter).populate('user', 'name email coopId').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Loan.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      loans,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('List loans error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching loans' });
  }
};

// @desc    Approve a loan application
// @route   PUT /api/admin/loans/:id/approve
// @access  Private/Admin
const approveLoan = async (req, res) => {
  try {
    const { note } = req.body;
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan application not found' });
    }
    if (loan.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Loan is already ${loan.status}` });
    }

    loan.status = 'approved';
    loan.reviewedBy = req.admin._id; // Changed from req.user._id
    loan.reviewedAt = new Date();
    loan.reviewNote = note;
    await loan.save();

    await notify(loan.user, {
      title: 'Loan approved',
      message: `Your loan request for ₦${loan.amount.toLocaleString()} has been approved.`,
      type: 'success',
    });

    res.status(200).json({ success: true, message: 'Loan approved', loan });
  } catch (error) {
    console.error('Approve loan error:', error);
    res.status(500).json({ success: false, message: 'Server error approving loan' });
  }
};

// @desc    Reject a loan application
// @route   PUT /api/admin/loans/:id/reject
// @access  Private/Admin
const rejectLoan = async (req, res) => {
  try {
    const { note } = req.body;
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan application not found' });
    }
    if (loan.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Loan is already ${loan.status}` });
    }

    loan.status = 'rejected';
    loan.reviewedBy = req.admin._id; // Changed from req.user._id
    loan.reviewedAt = new Date();
    loan.reviewNote = note || 'Did not meet lending criteria';
    await loan.save();

    await notify(loan.user, {
      title: 'Loan application declined',
      message: `Your loan request for ₦${loan.amount.toLocaleString()} was declined: ${loan.reviewNote}`,
      type: 'warning',
    });

    res.status(200).json({ success: true, message: 'Loan rejected', loan });
  } catch (error) {
    console.error('Reject loan error:', error);
    res.status(500).json({ success: false, message: 'Server error rejecting loan' });
  }
};

// ---------------------------------------------------------------------------
// Basic Reports
// ---------------------------------------------------------------------------

// @desc    Cooperative-wide summary report
// @route   GET /api/admin/reports/summary
// @access  Private/Admin
const getReportsSummary = async (req, res) => {
  try {
    const [
      totalMembers,
      pendingMembers,
      activeMembers,
      savingsTotals,
      contributionTotals,
      pendingTransactions,
      loanCounts,
      loanAmounts,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ approvalStatus: 'pending' }),
      User.countDocuments({ approvalStatus: 'approved', isActive: true }),
      Transaction.aggregate([
        { $match: { category: 'savings', status: 'cleared' } },
        {
          $group: {
            _id: null,
            deposits: { $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] } },
            withdrawals: { $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] } },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: { category: 'contribution', status: 'cleared' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.countDocuments({ status: 'pending' }),
      Loan.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Loan.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const savings = savingsTotals[0] || { deposits: 0, withdrawals: 0 };
    const loanStatusCounts = loanCounts.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {});

    res.status(200).json({
      success: true,
      report: {
        members: {
          total: totalMembers,
          pendingApproval: pendingMembers,
          active: activeMembers,
        },
        savings: {
          totalDeposits: savings.deposits,
          totalWithdrawals: savings.withdrawals,
          netBalance: savings.deposits - savings.withdrawals,
        },
        contributions: {
          totalCollected: contributionTotals[0]?.total || 0,
        },
        pendingTransactions,
        loans: {
          pending: loanStatusCounts.pending || 0,
          approved: loanStatusCounts.approved || 0,
          rejected: loanStatusCounts.rejected || 0,
          repaid: loanStatusCounts.repaid || 0,
          totalDisbursed: loanAmounts[0]?.total || 0,
        },
      },
    });
  } catch (error) {
    console.error('Reports summary error:', error);
    res.status(500).json({ success: false, message: 'Server error generating report' });
  }
};

module.exports = {
  listUsers,
  getUser,
  updateUserRole,
  setUserStatus,
  deleteUser,
  getStats,
  listPendingMembers,
  approveMember,
  rejectMember,
  listTransactions,
  createTransaction,
  clearTransaction,
  rejectTransaction,
  listLoans,
  approveLoan,
  rejectLoan,
  getReportsSummary,
};