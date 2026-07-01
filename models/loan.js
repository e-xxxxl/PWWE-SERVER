const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Loan amount is required'],
      min: [1, 'Amount must be greater than zero'],
    },
    purpose: {
      type: String,
      required: [true, 'Purpose is required'],
      trim: true,
      maxlength: 500,
    },
    termMonths: {
      type: Number,
      enum: [3, 6, 12],
      default: 3,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'repaid'],
      default: 'pending',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewNote: { type: String, trim: true, maxlength: 280 },
  },
  { timestamps: true }
);

loanSchema.index({ user: 1, createdAt: -1 });
loanSchema.index({ status: 1 });

// Replace: module.exports = mongoose.model('Loan', loanSchema);
// With:
module.exports = mongoose.models.Loan || mongoose.model('Loan', loanSchema);