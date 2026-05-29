// utils/attachmentHelper.js
import fs from 'fs';
import path from 'path';

const saveAttachments = async (files, uploadDir = 'uploads/reports') => {
  if (!files || files.length === 0) return [];
  
  const savedAttachments = [];
  const baseUrl = process.env.BASE_URL || `https://${process.env.HOST || 'localhost'}:${process.env.PORT || 5001}`;
  
  for (const file of files) {
    const filePath = path.join(uploadDir, file.filename);
    savedAttachments.push({
      name: file.originalname,
      filename: file.filename,
      url: `${baseUrl}/${uploadDir}/${file.filename}`,
      size: file.size,
      mimeType: file.mimetype,
      uploaded_at: new Date().toISOString()
    });
  }
  
  return savedAttachments;
};

export default saveAttachments;