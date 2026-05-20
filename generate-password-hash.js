import bcrypt from 'bcryptjs';

const run = async () => {
  try {
    const hash = await bcrypt.hash('FederalAdmin@123', 10);
    console.log(hash);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
