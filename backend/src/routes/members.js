const router = require('express').Router();
const db = require('../db');

// GET /api/members?phone=01012345678
router.get('/', async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: '전화번호를 입력해 주세요.' });

    const memberResult = await db.query(
      `SELECT * FROM members WHERE phone = $1`, [phone]
    );
    if (!memberResult.rows.length) {
      return res.status(404).json({ error: '회원을 찾을 수 없습니다.' });
    }
    const member = memberResult.rows[0];

    // 사용 가능한 쿠폰 조회
    const couponResult = await db.query(
      `SELECT * FROM member_coupons
       WHERE member_id = $1 AND is_used = false
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [member.id]
    );

    res.json({ ...member, coupons: couponResult.rows });
  } catch (err) { next(err); }
});

// POST /api/members — 회원 등록
router.post('/', async (req, res, next) => {
  try {
    const { phone, name } = req.body;
    if (!phone) return res.status(400).json({ error: '전화번호를 입력해 주세요.' });

    const result = await db.query(
      `INSERT INTO members (phone, name) VALUES ($1, $2)
       ON CONFLICT (phone) DO UPDATE SET name = COALESCE($2, members.name)
       RETURNING *`,
      [phone, name || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
