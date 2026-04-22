/**
 * 글로벌 오류 핸들러
 */
const errorHandler = (err, req, res, next) => {
  console.error('⚠️  API 오류:', err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // PostgreSQL 고유 제약 위반
  if (err.code === '23505') {
    return res.status(409).json({ error: '중복된 데이터가 존재합니다.' });
  }

  // PostgreSQL 외래키 위반
  if (err.code === '23503') {
    return res.status(400).json({ error: '참조하는 데이터가 존재하지 않습니다.' });
  }

  const status = err.status || 500;
  const message = err.message || '서버 오류가 발생했습니다.';
  res.status(status).json({ error: message });
};

module.exports = errorHandler;
