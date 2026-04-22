const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const SECRET = process.env.JWT_SECRET || 'everest-pos-secret';

// POST /api/auth/pin — 직원 PIN 로그인
router.post('/pin', async (req, res, next) => {
  try {
    const { branch_id, pin } = req.body;
    if (!branch_id || !pin) {
      return res.status(400).json({ error: '지점 ID와 PIN을 입력해 주세요.' });
    }

    const result = await db.query(
      `SELECT s.*, b.name as branch_name
       FROM staff s
       JOIN branches b ON b.id = s.branch_id
       WHERE s.branch_id = $1 AND s.is_active = true`,
      [branch_id]
    );

    // PIN 비교 (개발 중 임시: '1234' 평문 비교)
    let matched = null;
    for (const staff of result.rows) {
      const ok = (staff.pin_hash === pin) ||
        (await bcrypt.compare(pin, staff.pin_hash).catch(() => false));
      if (ok) { matched = staff; break; }
    }

    if (!matched) {
      return res.status(401).json({ error: 'PIN이 올바르지 않습니다.' });
    }

    const token = jwt.sign(
      {
        staff_id:    matched.id,
        name_ko:     matched.name_ko,
        role:        matched.role,
        branch_id:   matched.branch_id,
        branch_name: matched.branch_name
      },
      SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      staff: {
        id:          matched.id,
        name_ko:     matched.name_ko,
        role:        matched.role,
        branch_id:   matched.branch_id,
        branch_name: matched.branch_name
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — 현재 세션 확인
router.get('/me', require('../middleware/auth').requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
