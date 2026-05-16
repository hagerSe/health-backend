import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { protect } from '../middleware/auth.js';
import {
  uploadFile,
  uploadMultipleFiles,
  renewFileUrl,
  deleteFile
} from '../controllers/uploadController.js';
import { getFileSignedUrl } from '../Services/b2Upload.js';
import fs from 'fs';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ✅ ADD THIS DOWNLOAD ROUTE
router.get('/download/:fileKey', protect, async (req, res) => {
  try {
    const { fileKey } = req.params;
    const decodedKey = decodeURIComponent(fileKey);
    
    console.log(`📥 Download requested for key: ${decodedKey}`);
    
    // Check if it's a B2 file key (contains 'attachments/')
    if (decodedKey.includes('attachments/')) {
      try {
        const signedUrl = await getFileSignedUrl(decodedKey);
        console.log(`   ✅ Redirecting to B2 signed URL`);
        return res.redirect(signedUrl);
      } catch (b2Error) {
        console.error('   ❌ B2 download failed:', b2Error.message);
      }
    }
    
    // Try local file
    const localPath = path.join(__dirname, '../uploads', decodedKey);
    if (fs.existsSync(localPath)) {
      console.log(`   ✅ Found file locally: ${localPath}`);
      const originalName = path.basename(decodedKey);
      return res.download(localPath, originalName);
    }
    
    console.error(`   ❌ File not found: ${decodedKey}`);
    res.status(404).json({ success: false, message: "File not found" });
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Routes
router.post('/upload', protect, upload.single('file'), uploadFile);
router.post('/upload/multiple', protect, upload.array('files', 10), uploadMultipleFiles);
router.post('/upload/renew-url', protect, renewFileUrl);
router.delete('/upload', protect, deleteFile);

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

router.use('/uploads', express.static(uploadsDir));

console.log('✅ Upload routes configured');
console.log('   - POST /api/upload - Upload file');
console.log('   - GET /api/download/:fileKey - Download file');

export default router;