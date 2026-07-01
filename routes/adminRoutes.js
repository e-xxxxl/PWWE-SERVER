const express = require('express');
const router = express.Router();
const { protectAdmin, authorize } = require('../middleware/adminAuth');
const {
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
} = require('../controllers/adminController');

// All routes require authentication
router.use(protectAdmin);

// Routes accessible by both admin and super-admin
router.get('/stats', getStats);
router.get('/reports/summary', getReportsSummary);
router.get('/members/pending', listPendingMembers);
router.put('/members/:id/approve', approveMember);
router.put('/members/:id/reject', rejectMember);
router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.get('/transactions', listTransactions);
router.get('/loans', listLoans);

// Routes for managing transactions and loans (admin+super-admin)
router.post('/transactions', createTransaction);
router.put('/transactions/:id/clear', clearTransaction);
router.put('/transactions/:id/reject', rejectTransaction);
router.put('/loans/:id/approve', approveLoan);
router.put('/loans/:id/reject', rejectLoan);

// Routes that require super-admin only
router.put('/users/:id/status', authorize('super-admin'), setUserStatus);
router.put('/users/:id/role', authorize('super-admin'), updateUserRole);
router.delete('/users/:id', authorize('super-admin'), deleteUser);

module.exports = router;    