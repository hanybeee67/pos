const router = require('express').Router();
const db = require('../db');

// GET /api/categories
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM categories WHERE is_active = true ORDER BY sort_order, id`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/categories (관리자)
router.post('/', async (req, res, next) => {
  try {
    const { name_ko, name_en, sort_order, color, icon } = req.body;
    const result = await db.query(
      `INSERT INTO categories (name_ko, name_en, sort_order, color, icon)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name_ko, name_en || '', sort_order || 0, color || '#0ECFB1', icon || '🍽️']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/categories/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name_ko, name_en, sort_order, color, icon, is_active } = req.body;
    const result = await db.query(
      `UPDATE categories SET
         name_ko    = COALESCE($2, name_ko),
         name_en    = COALESCE($3, name_en),
         sort_order = COALESCE($4, sort_order),
         color      = COALESCE($5, color),
         icon       = COALESCE($6, icon),
         is_active  = COALESCE($7, is_active)
       WHERE id = $1 RETURNING *`,
      [id, name_ko, name_en, sort_order, color, icon, is_active]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
