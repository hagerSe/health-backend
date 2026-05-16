import dotenv from 'dotenv';
import { S3Client, PutObjectCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

dotenv.config();

async function testB2Connection() {
  console.log('🧪 Testing Backblaze B2 Connection...\n');
  
  console.log('📋 Environment Variables:');
  console.log(`   B2_KEY_ID: ${process.env.B2_KEY_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   B2_APPLICATION_KEY: ${process.env.B2_APPLICATION_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   B2_BUCKET_NAME: ${process.env.B2_BUCKET_NAME || '❌ Missing'}`);
  console.log(`   B2_ENDPOINT: ${process.env.B2_ENDPOINT || '❌ Missing'}`);
  console.log('');
  
  const s3Client = new S3Client({
    region: process.env.B2_REGION || "eu-central-003",
    endpoint: process.env.B2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.B2_KEY_ID,
      secretAccessKey: process.env.B2_APPLICATION_KEY,
    },
    forcePathStyle: true,
  });
  
  try {
    // Test 1: List buckets to verify credentials
    console.log('📡 Test 1: Listing buckets to verify credentials...');
    const listCommand = new ListBucketsCommand({});
    const buckets = await s3Client.send(listCommand);
    console.log(`✅ Success! Found ${buckets.Buckets?.length || 0} buckets`);
    
    // Find our bucket
    const ourBucket = buckets.Buckets?.find(b => b.Name === process.env.B2_BUCKET_NAME);
    if (ourBucket) {
      console.log(`✅ Bucket "${process.env.B2_BUCKET_NAME}" exists!`);
    } else {
      console.log(`⚠️ Bucket "${process.env.B2_BUCKET_NAME}" not found in your account`);
    }
    console.log('');
    
    // Test 2: Upload a test file
    console.log('📡 Test 2: Uploading test file...');
    const testContent = `Test file uploaded at ${new Date().toISOString()}`;
    const testKey = `test/connection-test-${Date.now()}.txt`;
    
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
      Metadata: {
        'test': 'true',
        'timestamp': Date.now().toString()
      }
    });
    
    const uploadResult = await s3Client.send(uploadCommand);
    console.log(`✅ Upload successful! ETag: ${uploadResult.ETag}`);
    
    // Test 3: Generate signed URL
    console.log('');
    console.log('📡 Test 3: Generating signed URL...');
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const getCommand = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: testKey,
    });
    
    const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
    console.log(`✅ Signed URL generated: ${signedUrl.substring(0, 100)}...`);
    
    console.log('\n🎉 All tests passed! Backblaze B2 is working correctly!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error name:', error.name);
    
    if (error.code === 'NetworkingError') {
      console.error('\n💡 Network error - Check your internet connection and firewall');
    } else if (error.code === 'CredentialsError') {
      console.error('\n💡 Credentials error - Check your B2_KEY_ID and B2_APPLICATION_KEY in .env');
    } else if (error.code === 'AccessDenied') {
      console.error('\n💡 Access denied - Your application key may not have sufficient permissions');
      console.error('   Make sure your key has: readFiles, writeFiles, listFiles, deleteFiles');
    } else if (error.code === 'NoSuchBucket') {
      console.error(`\n💡 Bucket "${process.env.B2_BUCKET_NAME}" does not exist`);
      console.error('   Check your B2_BUCKET_NAME in .env');
    } else if (error.code === 'InvalidAccessKeyId') {
      console.error('\n💡 Invalid Access Key ID - Check your B2_KEY_ID');
    } else if (error.code === 'SignatureDoesNotMatch') {
      console.error('\n💡 Signature mismatch - Check your B2_APPLICATION_KEY');
    }
  }
}

testB2Connection();