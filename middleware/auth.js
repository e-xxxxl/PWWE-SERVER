const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Protect routes - require a valid JWT
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!req.user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated',
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }
};

// Restrict a route to specific roles, e.g. authorize('admin', 'super-admin')
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
      });
    }
    next();
  };
};

// Gate cooperative-financial actions (savings, contributions, loans) behind
// admin approval. Profile/notification access is allowed before approval so
// a pending member can still see their status.
const requireApproved = (req, res, next) => {
  if (req.user.approvalStatus !== 'approved') {
    return res.status(403).json({
      success: false,
      message:
        req.user.approvalStatus === 'rejected'
          ? 'Your membership application was not approved. Contact support for details.'
          : 'Your membership is still pending admin approval',
    });
  }
  next();
};

module.exports = { protect, authorize, requireApproved };