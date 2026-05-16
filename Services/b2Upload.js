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

// ✅ FIXED: Complete exports
export default {
  uploadToB2,
  getFileSignedUrl,
  deleteFromB2
};