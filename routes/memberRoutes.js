const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, requireApproved } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const {
  getSavingsBalance,
  getSavingsHistory,
  requestDeposit,
  payRegistrationFee,
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

const depositValidation = [
  body('amount').isFloat({ gt: 0 }).withMessage('Enter a valid deposit amount'),
  body('method').optional().isIn(['bank_transfer', 'cash', 'card', 'other']).withMessage('Invalid payment method'),
  body('paymentPurpose').optional().isIn(['shares', 'loan_repayment', 'savings', 'other', 'registration']).withMessage('Invalid payment purpose'),
];

// The one-time registration fee is payable before admin approval — a brand
// new member needs to pay it as part of joining.
router.post('/registration-fee', upload.single('receipt'), depositValidation, validate, payRegistrationFee);

// Savings and loans require an approved membership
router.use(requireApproved);

const loanValidation = [
  body('amount').isFloat({ gt: 0 }).withMessage('Enter a valid loan amount'),
  body('purpose').trim().notEmpty().withMessage('Purpose is required'),
  body('termMonths').optional().isIn([3, 6, 12]).withMessage('Term must be 3, 6, or 12 months'),
  body('guarantorName').trim().notEmpty().withMessage("Guarantor's full name is required"),
  body('guarantorMembershipId').trim().notEmpty().withMessage("Guarantor's membership ID is required"),
];

router.get('/savings/balance', getSavingsBalance);
router.get('/savings/history', getSavingsHistory);
// multer runs first so express-validator sees the parsed multipart fields
router.post('/savings/deposit', upload.single('receipt'), depositValidation, validate, requestDeposit);

router.get('/loans', getMyLoans);
router.post('/loans', loanValidation, validate, applyForLoan);

module.exports = router;
