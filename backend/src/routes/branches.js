const router = require('express').Router();
const db = require('../db');

// GET /api/branches
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM branches WHERE is_active = true ORDER BY id`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// GET /api/branches/:id
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM branches WHERE id = $1`, [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: '지점을 찾을 수 없습니다.' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
