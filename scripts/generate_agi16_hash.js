// backend/generate_agi16_hash.js
import bcrypt from 'bcryptjs';

const generateHash = async () => {
  try {
    const password = 'agi16';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    console.log('='.repeat(50));
    console.log('PASSWORD:', password);
    console.log('='.repeat(50));
    console.log('GENERATED HASH:');
    console.log(hash);
    console.log('='.repeat(50));
    console.log('Hash length:', hash.length);
    console.log('='.repeat(50));
    
    // Verify the hash works
    const isValid = await bcrypt.compare(password, hash);
    console.log('Verification test:', isValid ? '✅ SUCCESS - Hash works!' : '❌ FAILED - Hash is invalid');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('Error generating hash:', error);
  }
};

generateHash();