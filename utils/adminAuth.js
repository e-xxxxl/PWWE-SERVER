const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

const ADMINS_FILE = path.join(__dirname, '..', 'config', 'admins.json');

/**
 * Read and parse admins.json
 */
const getAdmins = async () => {
  try {
    const data = await fs.readFile(ADMINS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.admins || [];
  } catch (error) {
    console.error('Error reading admins file:', error);
    return [];
  }
};

/**
 * Find admin by email
 */
const findAdminByEmail = async (email) => {
  const admins = await getAdmins();
  return admins.find(
    (admin) => admin.email.toLowerCase() === email.toLowerCase()
  ) || null;
};

/**
 * Validate admin credentials
 */
const validateAdminCredentials = async (email, password) => {
  const admin = await findAdminByEmail(email);
  if (!admin) return null;

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) return null;

  // Return admin data without password
  const { password: _, ...adminData } = admin;
  return adminData;
};

/**
 * Add a new admin to the file
 */
const addAdmin = async (adminData) => {
  const admins = await getAdmins();
  
  // Check if email already exists
  const exists = admins.find(
    (a) => a.email.toLowerCase() === adminData.email.toLowerCase()
  );
  if (exists) {
    throw new Error('Admin with this email already exists');
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(adminData.password, salt);

  const newAdmin = {
    email: adminData.email,
    password: hashedPassword,
    name: adminData.name,
    role: adminData.role || 'admin',
  };

  admins.push(newAdmin);

  await fs.writeFile(
    ADMINS_FILE,
    JSON.stringify({ admins }, null, 2),
    'utf-8'
  );

  const { password: _, ...adminWithoutPassword } = newAdmin;
  return adminWithoutPassword;
};

module.exports = {
  getAdmins,
  findAdminByEmail,
  validateAdminCredentials,
  addAdmin,
};