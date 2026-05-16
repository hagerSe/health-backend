import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

console.log("🔧 Initializing Backblaze B2 client...");
console.log(`📦 Bucket: ${process.env.B2_BUCKET_NAME}`);
console.log(`🌍 Endpoint: ${process.env.B2_ENDPOINT}`);
console.log(`🔑 Key ID: ${process.env.B2_KEY_ID ? process.env.B2_KEY_ID.substring(0, 15) + '...' : 'MISSING'}`);
console.log(`🔐 Application Key: ${process.env.B2_APPLICATION_KEY ? '✅ Present' : '❌ MISSING'}`);

// Validate required environment variables
if (!process.env.B2_KEY_ID) {
  console.error("❌ ERROR: B2_KEY_ID is missing in .env file");
}
if (!process.env.B2_APPLICATION_KEY) {
  console.error("❌ ERROR: B2_APPLICATION_KEY is missing in .env file");
}
if (!process.env.B2_BUCKET_NAME) {
  console.error("❌ ERROR: B2_BUCKET_NAME is missing in .env file");
}

const s3Client = new S3Client({
  region: process.env.B2_REGION || "eu-central-003",
  endpoint: process.env.B2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
  forcePathStyle: true,
});

export default s3Client;