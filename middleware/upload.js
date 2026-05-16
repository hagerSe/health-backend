import multer from "multer";
import path from "path";

const storage = multer.memoryStorage();

// Report upload filter - supports PowerPoint and other office files
const reportFileFilter = (req, file, cb) => {
  const allowedTypes = [
    // Images
    "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    // PowerPoint
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
    // Text
    "text/plain",
    // Archives
    "application/zip",
    "application/x-zip-compressed"
  ];
  
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.ppt', '.pptx', '.ppsx', '.doc', '.docx', '.xls', '.xlsx', '.pdf', '.zip'];
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed for report: ${file.mimetype}`), false);
  }
};

// General upload filter
const generalFileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "video/mp4",
    "audio/mpeg",
    "text/plain",
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}`), false);
  }
};

// Create multer instances
const upload = multer({
  storage,
  fileFilter: generalFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

const reportUpload = multer({
  storage,
  fileFilter: reportFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ✅ FIXED: Add default export
export default upload;

// ✅ Named exports
export { reportUpload };