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

// @desc    List admin/moderator accounts
// @route   GET /api/admin/auth/admins
// @access  Private/Super-admin
const listAdmins = async (req, res) => {
  try {
    const admins = await Admin.find({}).sort({ createdAt: -1 });
    res.json({ success: true, admins: admins.map((a) => a.toJSON()) });
  } catch (error) {
    console.error('List admins error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching admin accounts' });
  }
};

// @desc    Create a new admin or moderator account
// @route   POST /api/admin/auth/admins
// @access  Private/Super-admin
const createAdmin = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required',
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }
    // Super-admin accounts are created out-of-band (seed script), not
    // through this endpoint, to avoid casual privilege escalation.
    const assignedRole = ['moderator', 'admin'].includes(role) ? role : 'admin';

    const existing = await Admin.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An admin account with this email already exists',
      });
    }

    const admin = await Admin.create({
      name,
      email: email.toLowerCase(),
      password,
      role: assignedRole,
      createdBy: req.admin._id,
    });

    res.status(201).json({
      success: true,
      message: `${assignedRole === 'moderator' ? 'Moderator' : 'Admin'} account created`,
      admin: admin.toJSON(),
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ success: false, message: 'Server error creating admin account' });
  }
};

module.exports = {
  adminLogin,
  checkAdmin,
  listAdmins,
  createAdmin,
};