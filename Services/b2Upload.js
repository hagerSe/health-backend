// Services/b2Upload.js
import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3Client from "../config/backblaze.js";

/**
 * Upload a file to Backblaze B2 (Private Bucket)
 * Returns a signed URL that expires after 7 days
 */
export async function uploadToB2(file, userId) {
  try {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `attachments/${userId || 'anonymous'}/${timestamp}-${randomString}-${sanitizedName}`;

    console.log(`📤 Uploading to B2: ${key}`);
    console.log(`   Size: ${(file.size / 1024).toFixed(2)} KB`);
    console.log(`   Type: ${file.mimetype}`);
    console.log(`   Bucket: ${process.env.B2_BUCKET_NAME}`);

    const command = new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        'original-name': encodeURIComponent(file.originalname),
        'user-id': userId || 'anonymous',
        'uploaded-at': new Date().toISOString()
      }
    });

    const result = await s3Client.send(command);
    console.log(`✅ Uploaded to B2 successfully, ETag: ${result.ETag}`);

    const getCommand = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, getCommand, {
      expiresIn: 604800,
    });

    console.log(`   Signed URL generated (expires in 7 days)`);
    console.log(`   File key: ${key}`);

    return {
      success: true,
      url: signedUrl,
      key: key,
      filename: key.split('/').pop(),
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      expiresAt: new Date(Date.now() + 604800000).toISOString(),
      location: 'b2'
    };
    
  } catch (error) {
    console.error("❌ B2 Upload Error:", error.message);
    throw new Error(`Upload failed: ${error.message}`);
  }
}

/**
 * Generate a new signed URL for an existing file
 */
export async function getFileSignedUrl(key) {
  try {
    if (!key) {
      throw new Error("File key is required");
    }

    console.log(`🔑 Getting signed URL for key: ${key}`);

    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 604800,
    });
    
    console.log(`✅ Signed URL generated`);
    return signedUrl;
  } catch (error) {
    console.error("❌ Generate URL Error:", error);
    throw new Error(`Failed to generate URL: ${error.message}`);
  }
}

/**
 * Delete a file from Backblaze B2
 */
export async function deleteFromB2(key) {
  try {
    if (!key) {
      throw new Error("File key is required");
    }

    const command = new DeleteObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    console.log(`🗑️ Deleted from B2: ${key}`);

    return { success: true, message: "File deleted successfully" };
  } catch (error) {
    console.error("❌ B2 Delete Error:", error);
    throw new Error(`Delete failed: ${error.message}`);
  }
}

// ============================================================
// ✅ ADD THESE MISSING FUNCTIONS
// ============================================================

/**
 * Parse attachments from database storage
 * @param {string|Array|Object} attachmentsData - Raw attachments data from database
 * @returns {Array} Parsed attachments array
 */
export function parseAttachments(attachmentsData) {
  if (!attachmentsData) return [];
  
  if (Array.isArray(attachmentsData)) {
    return attachmentsData;
  }
  
  if (typeof attachmentsData === 'string') {
    try {
      const parsed = JSON.parse(attachmentsData);
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) {
      console.error("Error parsing attachments JSON:", e.message);
      return [];
    }
  }
  
  if (typeof attachmentsData === 'object') {
    return [attachmentsData];
  }
  
  return [];
}

/**
 * Format attachments for API response
 * @param {Array} attachments - Raw attachments array
 * @returns {Array} Formatted attachments with signed URLs
 */
export function formatAttachmentsForResponse(attachments) {
  const parsed = parseAttachments(attachments);
  
  return parsed.map(att => ({
    filename: att.filename || att.key?.split('/').pop() || 'file',
    originalName: att.originalName || att.filename || 'Unknown',
    mimeType: att.mimeType || att.mimetype || 'application/octet-stream',
    size: att.size || 0,
    url: att.url || null,
    key: att.key || null,
    expiresAt: att.expiresAt || null
  }));
}

/**
 * Check if report has attachments
 * @param {Array} attachments - Attachments array
 * @returns {boolean}
 */
export function hasAttachments(attachments) {
  const parsed = parseAttachments(attachments);
  return parsed.length > 0;
}

/**
 * Get attachment count
 * @param {Array} attachments - Attachments array
 * @returns {number}
 */
export function getAttachmentCount(attachments) {
  const parsed = parseAttachments(attachments);
  return parsed.length;
}

// ✅ FIXED: Complete exports with all functions
export default {
  uploadToB2,
  getFileSignedUrl,
  deleteFromB2,
  parseAttachments,
  formatAttachmentsForResponse,
  hasAttachments,
  getAttachmentCount
};