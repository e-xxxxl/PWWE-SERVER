const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, requireApproved } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  getSavingsBalance,
  getSavingsHistory,
  requestDeposit,
  getContributionHistory,
  applyForLoan,
  getMyLoans,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/memberController');

// Everything here requires a logged-in user
router.use(protect);

// Notifications — available even before approval, so a pending member can
// see their status update.
router.get('/notifications', getNotifications);
router.put('/notifications/read-all', markAllNotificationsRead);
router.put('/notifications/:id/read', markNotificationRead);

// Savings, contributions, and loans require an approved membership
router.use(requireApproved);

const depositValidation = [
  body('amount').isFloat({ gt: 0 }).withMessage('Enter a valid deposit amount'),
  body('method').optional().isIn(['bank_transfer', 'cash', 'card', 'other']).withMessage('Invalid payment method'),
];

const loanValidation = [
  body('amount').isFloat({ gt: 0 }).withMessage('Enter a valid loan amount'),
  body('purpose').trim().notEmpty().withMessage('Purpose is required'),
  body('termMonths').optional().isIn([3, 6, 12]).withMessage('Term must be 3, 6, or 12 months'),
];

router.get('/savings/balance', getSavingsBalance);
router.get('/savings/history', getSavingsHistory);
router.post('/savings/deposit', depositValidation, validate, requestDeposit);

router.get('/contributions', getContributionHistory);

router.get('/loans', getMyLoans);
router.post('/loans', loanValidation, validate, applyForLoan);

module.exports = router;