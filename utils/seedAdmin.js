const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Admin = require('../models/admin');

dotenv.config();

const seedAdmins = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing admins (optional - comment out if you don't want to delete)
    await Admin.deleteMany({});
    console.log('Cleared existing admins');

    const admins = [
      {
        email: 'admin@pwwe.com',
        password: 'admin9822@##',
        name: 'Super Admin',
        role: 'super-admin'
      },
      {
        email: 'manager@pwwe.com',
        password: 'manager9822@##',
        name: 'Manager',
        role: 'admin'
      }
    ];

    for (const admin of admins) {
      await Admin.create(admin);
      console.log(`Created admin: ${admin.email}`);
    }

    console.log('Admin seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedAdmins();