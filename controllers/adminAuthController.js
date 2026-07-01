const Admin = require('../models/admin');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (admin) => {
  return jwt.sign(
    { 
      id: admin._id,
      email: admin.email, 
      name: admin.name, 
      role: admin.role 
    },
    process.env.JWT_SECRET || 'your-secret-key-change-this-in-env',
    { expiresIn: '24h' }
  );
};

// Admin login
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find admin by email
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Contact super admin.'
      });
    }

    // Check password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login - wrap in try/catch to prevent errors from stopping login
    try {
      admin.lastLogin = new Date();
      await admin.save({ validateBeforeSave: false }); // Skip validation for lastLogin update
    } catch (saveError) {
      console.error('Error updating last login:', saveError);
      // Don't fail the login if just the lastLogin update fails
    }

    // Generate token
    const token = generateToken(admin);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: admin.toJSON()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

// Check admin (protected route)
const checkAdmin = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }
    
    res.json({
      success: true,
      admin: admin.toJSON()
    });
  } catch (error) {
    console.error('Check admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  adminLogin,
  checkAdmin
};