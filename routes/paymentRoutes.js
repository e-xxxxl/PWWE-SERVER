const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getPaymentConfig,
  initializeDeposit,
  verifyDeposit,
  getPaymentHistory,
  getUserTransactions
} = require('../controllers/paymentController');

// Whether online payment is configured on this server
router.get('/config', protect, getPaymentConfig);

// Initialize a deposit payment
router.post('/initialize-deposit', protect, initializeDeposit);

// Verify a payment (called by Paystack webhook or frontend)
router.get('/verify/:reference', protect, verifyDeposit);

// Webhook endpoint (called by Paystack - no auth required but needs signature verification)
router.post('/webhook', require('../controllers/paymentController').handleWebhook);

// Get payment history for a user
router.get('/history', protect, getPaymentHistory);

// Get all transactions for a user
router.get('/transactions', protect, getUserTransactions);

module.exports = router;