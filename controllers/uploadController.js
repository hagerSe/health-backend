import { uploadToB2 } from "../Services/b2Upload.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, '../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file provided" });
    }

    const userId = req.user?.id || "anonymous";
    let result;
    
    try {
      // Try B2 upload first
      result = await uploadToB2(req.file, userId);
    } catch (b2Error) {
      console.log('B2 upload failed, using local storage:', b2Error.message);
      // Fallback to local storage
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
      const userFolder = userId === 'anonymous' ? 'anonymous' : `user_${userId}`;
      const folderPath = path.join(UPLOAD_DIR, userFolder);
      
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      
      const filename = `${timestamp}-${randomString}-${sanitizedName}`;
      const filePath = path.join(folderPath, filename);
      fs.writeFileSync(filePath, req.file.buffer);
      
      result = {
        success: true,
        url: `/uploads/${userFolder}/${filename}`,
        key: `${userFolder}/${filename}`,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        location: 'local',
        filename: filename
      };
    }

    res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      file: {
        url: result.url,
        key: result.key,
        filename: result.filename || result.key,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        location: result.location
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function uploadMultipleFiles(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: "No files provided" });
    }

    const userId = req.user?.id || "anonymous";
    const results = [];
    
    for (const file of req.files) {
      try {
        let result = await uploadToB2(file, userId);
        results.push({
          url: result.url,
          key: result.key,
          filename: result.filename || result.key,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype
        });
      } catch (error) {
        // Fallback to local
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
        const userFolder = userId === 'anonymous' ? 'anonymous' : `user_${userId}`;
        const folderPath = path.join(UPLOAD_DIR, userFolder);
        
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }
        
        const filename = `${timestamp}-${randomString}-${sanitizedName}`;
        const filePath = path.join(folderPath, filename);
        fs.writeFileSync(filePath, file.buffer);
        
        results.push({
          url: `/uploads/${userFolder}/${filename}`,
          key: `${userFolder}/${filename}`,
          filename: filename,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `${results.length} files uploaded successfully`,
      files: results,
    });
  } catch (error) {
    console.error("Multiple upload error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function renewFileUrl(req, res) {
  try {
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({ success: false, error: "File key is required" });
    }

    // Return local URL
    const url = `/uploads/${key}`;

    res.status(200).json({
      success: true,
      url: url,
      expiresAt: new Date(Date.now() + 604800000).toISOString(),
    });
  } catch (error) {
    console.error("Renew URL error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteFile(req, res) {
  try {
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({ success: false, error: "File key is required" });
    }

    // Delete from local storage
    const filePath = path.join(UPLOAD_DIR, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}