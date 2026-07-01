const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'super-admin'],
    default: 'admin'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
adminSchema.pre('save', function(next) {
  const admin = this;
  
  // Update timestamp
  admin.updatedAt = new Date();
  
  // Only hash the password if it has been modified (or is new)
  if (!admin.isModified('password')) return next();
  
  // Generate a salt
  bcrypt.genSalt(10, function(err, salt) {
    if (err) return next(err);
    
    // Hash the password using our new salt
    bcrypt.hash(admin.password, salt, function(err, hash) {
      if (err) return next(err);
      
      // Override the cleartext password with the hashed one
      admin.password = hash;
      next();
    });
  });
});

// Compare password method
adminSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Remove password from JSON output
adminSchema.methods.toJSON = function() {
  const admin = this.toObject();
  delete admin.password;
  delete admin.__v;
  return admin;
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;