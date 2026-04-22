const jwt = require('jsonwebtoken');
const db = require('../db');

/**
 * JWT 인증 미들웨어 (관리자/매니저용)
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'everest-pos-secret');
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
};

/**
 * 관리자 권한 확인
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  next();
};

/**
 * 서버 간 통신용 API Key 인증
 */
const requireApiKey = (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ error: '유효하지 않은 API Key입니다.' });
  }
  next();
};

/**
 * T-Order Channel API Key 인증
 */
const requireTorderKey = (req, res, next) => {
  const key = req.headers['x-channel-api-key'];
  if (!key || key !== process.env.TORDER_CHANNEL_API_KEY) {
    return res.status(401).json({ error: '유효하지 않은 T-Order Channel Key입니다.' });
  }
  next();
};

module.exports = { requireAuth, requireAdmin, requireApiKey, requireTorderKey };
