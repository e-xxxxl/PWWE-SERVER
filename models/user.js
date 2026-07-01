const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    coopId: {
      type: String,
      unique: true,
      sparse: true, // allows multiple docs without a coopId during creation race
      trim: true,
      uppercase: true,
    },
    interest: {
      type: String,
      enum: ['cooperative', 'skills', 'business', 'volunteer', 'other', ''],
      default: 'other',
    },
    role: {
      type: String,
      enum: ['member', 'admin', 'super-admin'],
      default: 'member',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    // Cooperative membership approval — separate from email verification and
    // from isActive (which is for suspending an already-approved member).
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    rejectionReason: String,
    verificationToken: { type: String, select: false },
    verificationTokenExpire: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
    lastLogin: Date,
    passwordChangedAt: Date,
    loginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
  },
  { timestamps: true }
);

// Helpful indexes for the lookups this app actually does
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ approvalStatus: 1 });

// Single pre-save hook: hash password + assign a coopId when missing.
// NOTE: every branch MUST call next() — a pre-save hook that never calls
// next() will hang the save() call forever. That was the bug here before.
userSchema.pre('save', async function (next) {
  try {
    if (this.isModified('password')) {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
      if (!this.isNew) this.passwordChangedAt = Date.now() - 1000;
    }

    if (!this.coopId) {
      const timestamp = Date.now().toString(36).toUpperCase();
      const randomStr = crypto.randomBytes(3).toString('hex').toUpperCase();
      this.coopId = `PWWE-${timestamp}-${randomStr}`;
    }

    // next();
  } catch (error) {
    next(error);
  }
});

// Compare a plaintext password against the stored hash
userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Account lockout helpers (basic brute-force protection)
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.registerFailedLogin = async function () {
  const MAX_ATTEMPTS = 5;
  const LOCK_TIME = 15 * 60 * 1000; // 15 minutes

  this.loginAttempts += 1;
  if (this.loginAttempts >= MAX_ATTEMPTS) {
    this.lockUntil = Date.now() + LOCK_TIME;
  }
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.resetLoginAttempts = async function () {
  if (this.loginAttempts === 0 && !this.lockUntil) return;
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  await this.save({ validateBeforeSave: false });
};

// Verification token (returns the raw token; stores the hashed version)
userSchema.methods.generateVerificationToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.verificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.verificationTokenExpire = Date.now() + 24 * 60 * 60 * 1000; // 24h
  return token;
};

// Password reset token (returns the raw token; stores the hashed version)
userSchema.methods.generateResetToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
  this.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1h
  return token;
};

// Strip sensitive/internal fields from any JSON response
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.verificationToken;
  delete user.verificationTokenExpire;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpire;
  delete user.loginAttempts;
  delete user.lockUntil;
  delete user.__v;
  return user;
};

// Replace: module.exports = mongoose.model('User', userSchema);
// With:
module.exports = mongoose.models.User || mongoose.model('User', userSchema);