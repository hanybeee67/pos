const router = require('express').Router();
const db = require('../db');
const bcrypt = require('bcryptjs');

// GET /api/staff?branch_id=1
router.get('/', async (req, res, next) => {
  try {
    const { branch_id } = req.query;
    const result = await db.query(
      `SELECT id, branch_id, name_ko, name_en, role, is_active, created_at
       FROM staff WHERE branch_id = $1 AND is_active = true ORDER BY id`,
      [branch_id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/staff — 직원 등록
router.post('/', async (req, res, next) => {
  try {
    const { branch_id, name_ko, name_en, role, pin } = req.body;
    const pin_hash = await bcrypt.hash(pin, 10);
    const result = await db.query(
      `INSERT INTO staff (branch_id, name_ko, name_en, role, pin_hash)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, branch_id, name_ko, role`,
      [branch_id, name_ko, name_en || '', role || 'staff', pin_hash]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/staff/:id/pin — PIN 변경
router.patch('/:id/pin', async (req, res, next) => {
  try {
    const { pin } = req.body;
    const pin_hash = await bcrypt.hash(pin, 10);
    await db.query(`UPDATE staff SET pin_hash = $2 WHERE id = $1`, [req.params.id, pin_hash]);
    res.json({ message: 'PIN이 변경되었습니다.' });
  } catch (err) { next(err); }
});

module.exports = router;
