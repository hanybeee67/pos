const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('🐘 PostgreSQL 연결됨');
  }
});

pool.on('error', (err) => {
  console.error('⚠️  PostgreSQL 연결 오류:', err.message);
});

/**
 * 쿼리 실행 헬퍼
 * @param {string} text - SQL 쿼리
 * @param {Array}  params - 파라미터
 */
const query = (text, params) => pool.query(text, params);

/**
 * 트랜잭션 헬퍼
 * @param {Function} callback - (client) => Promise
 */
const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { query, pool, withTransaction };
