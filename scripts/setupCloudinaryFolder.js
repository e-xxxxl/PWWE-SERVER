// One-off setup script: creates the Cloudinary folder that payment receipts
// get uploaded into. Cloudinary would also auto-create it on first upload,
// but this makes it show up in the Media Library right away.
//
// Usage: node scripts/setupCloudinaryFolder.js
const dotenv = require('dotenv');
dotenv.config();

const { cloudinary, RECEIPTS_FOLDER } = require('../utils/cloudinary');

(async () => {
  try {
    const result = await cloudinary.api.create_folder(RECEIPTS_FOLDER);
    console.log(`Folder ready: ${RECEIPTS_FOLDER}`, result);
  } catch (error) {
    console.error('Could not create Cloudinary folder:', error.message || error);
    process.exitCode = 1;
  }
})();
