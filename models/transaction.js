const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      enum: ['savings', 'contribution'],
      required: true,
      default: 'savings',
    },
    type: {
      type: String,
      enum: ['deposit', 'withdrawal'],
      required: true,
      default: 'deposit',
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be greater than zero'],
    },
    method: {
      type: String,
      enum: ['bank_transfer', 'cash', 'card', 'other', 'paystack'], // added paystack
      default: 'bank_transfer',
    },
    status: {
      type: String,
      enum: ['pending', 'cleared', 'rejected', 'failed'], // added failed (paymentController uses it)
      default: 'pending',
    },
    // --- added for Paystack ---
    reference: {
      type: String,
      unique: true,
      sparse: true, // only Paystack txns have this; manual ones won't
    },
    paymentData: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    // ---------------------------
    note: { type: String, trim: true, maxlength: 280 },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    rejectionReason: String,
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, category: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });
// reference already indexed via unique: true

module.exports = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);