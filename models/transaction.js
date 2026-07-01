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
      enum: ['bank_transfer', 'cash', 'card', 'other'],
      default: 'bank_transfer',
    },
    status: {
      type: String,
      enum: ['pending', 'cleared', 'rejected'],
      default: 'pending',
    },
    note: { type: String, trim: true, maxlength: 280 },
    recordedBy: {
      // Admin/treasurer who logged it, if not self-reported by the member
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

// Replace: module.exports = mongoose.model('Transaction', transactionSchema);
// With:
module.exports = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);