const express = require('express');
const router = express.Router();
const { adminLogin, checkAdmin, listAdmins, createAdmin } = require('../controllers/adminAuthController');
const { protectAdmin, authorize } = require('../middleware/adminAuth');

// POST /api/admin/auth/login - Public
router.post('/login', adminLogin);

// GET /api/admin/auth/me - Protected
router.get('/me', protectAdmin, checkAdmin);

// Admin/moderator account management — super-admin only
router.get('/admins', protectAdmin, authorize('super-admin'), listAdmins);
router.post('/admins', protectAdmin, authorize('super-admin'), createAdmin);

module.exports = router;