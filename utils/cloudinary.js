const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Everything payment-receipt related lives under this folder in the
// Cloudinary media library.
const RECEIPTS_FOLDER = 'pwwe/payment_receipts';

// Upload a file buffer (from multer's memory storage) straight to Cloudinary
// via a stream, so we never write the receipt to disk.
const uploadReceipt = (buffer, { publicId } = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: RECEIPTS_FOLDER,
        resource_type: 'auto', // images and PDFs both land here correctly
        public_id: publicId,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

const destroyReceipt = (publicId, resourceType = 'image') =>
  cloudinary.uploader.destroy(publicId, { resource_type: resourceType });

module.exports = { cloudinary, uploadReceipt, destroyReceipt, RECEIPTS_FOLDER };
