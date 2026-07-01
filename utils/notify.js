const Notification = require('../models/Notification');

const notify = async (userId, { title, message, type = 'info' }) => {
  try {
    await Notification.create({ user: userId, title, message, type });
  } catch (error) {
    // Notifications are best-effort — never let a failure here break the
    // primary action (e.g. a loan approval should still succeed).
    console.error('Failed to create notification:', error.message);
  }
};

module.exports = notify;