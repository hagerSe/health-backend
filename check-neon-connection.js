import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_xHl1jzS2cEig@ep-proud-bush-ah3h3u77-pooler.c-3.us-east-1.aws.neon.tech/neondb',
  ssl: { rejectUnauthorized: false }
});

const run = async () => {
  try {
    await client.connect();
    const res = await client.query('select now()');
    console.log('OK', res.rows);
  } catch (err) {
    console.error('ERROR', err.message);
    console.error(err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
};

run();
