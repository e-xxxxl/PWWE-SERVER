const express = require('express');
const router = express.Router();
const { adminLogin, checkAdmin } = require('../controllers/adminAuthController');
const { protectAdmin } = require('../middleware/adminAuth');

// POST /api/admin/auth/login - Public
router.post('/login', adminLogin);

// GET /api/admin/auth/me - Protected
router.get('/me', protectAdmin, checkAdmin);

module.exports = router;