const router = require('express').Router();
const db = require('../db');

// GET /api/menus?branch_id=1
// 카테고리별로 묶인 메뉴 목록 반환
router.get('/', async (req, res, next) => {
  try {
    const catResult = await db.query(
      `SELECT c.id, c.name_ko, c.name_en, c.sort_order, c.color, c.icon
       FROM categories c WHERE c.is_active = true ORDER BY c.sort_order, c.id`
    );

    const categories = [];
    for (const cat of catResult.rows) {
      const menuResult = await db.query(
        `SELECT m.id, m.name_ko, m.name_en, m.price, m.image_url,
                m.is_active, m.is_sold_out, m.sort_order, m.printer_target,
                m.description_ko, m.description_en
         FROM menus m
         WHERE m.category_id = $1 AND m.is_active = true
         ORDER BY m.sort_order, m.id`,
        [cat.id]
      );
      categories.push({ ...cat, menus: menuResult.rows });
    }

    res.json({ categories });
  } catch (err) { next(err); }
});

// GET /api/menus/:id
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT m.*, c.name_ko as category_name
       FROM menus m JOIN categories c ON c.id = m.category_id
       WHERE m.id = $1`, [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: '메뉴를 찾을 수 없습니다.' });

    // 레시피도 같이 반환
    const recipe = await db.query(
      `SELECT * FROM menu_recipes WHERE menu_id = $1`, [req.params.id]
    );
    res.json({ ...result.rows[0], recipe: recipe.rows });
  } catch (err) { next(err); }
});

// POST /api/menus
router.post('/', async (req, res, next) => {
  try {
    const { category_id, name_ko, name_en, price, image_url,
            description_ko, printer_target, sort_order } = req.body;
    const result = await db.query(
      `INSERT INTO menus
         (category_id, name_ko, name_en, price, image_url, description_ko, printer_target, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [category_id, name_ko, name_en || '', price, image_url || null,
       description_ko || '', printer_target || 'kitchen', sort_order || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/menus/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name_ko, name_en, price, image_url, description_ko,
            printer_target, sort_order, is_active, is_sold_out, category_id } = req.body;
    const result = await db.query(
      `UPDATE menus SET
         category_id    = COALESCE($2,  category_id),
         name_ko        = COALESCE($3,  name_ko),
         name_en        = COALESCE($4,  name_en),
         price          = COALESCE($5,  price),
         image_url      = COALESCE($6,  image_url),
         description_ko = COALESCE($7,  description_ko),
         printer_target = COALESCE($8,  printer_target),
         sort_order     = COALESCE($9,  sort_order),
         is_active      = COALESCE($10, is_active),
         is_sold_out    = COALESCE($11, is_sold_out)
       WHERE id = $1 RETURNING *`,
      [id, category_id, name_ko, name_en, price, image_url,
       description_ko, printer_target, sort_order, is_active, is_sold_out]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/menus/:id/soldout — 품절 토글
router.patch('/:id/soldout', async (req, res, next) => {
  try {
    const { is_sold_out } = req.body;
    const result = await db.query(
      `UPDATE menus SET is_sold_out = $2 WHERE id = $1 RETURNING id, name_ko, is_sold_out`,
      [req.params.id, is_sold_out]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/menus/:id (비활성화)
router.delete('/:id', async (req, res, next) => {
  try {
    await db.query(`UPDATE menus SET is_active = false WHERE id = $1`, [req.params.id]);
    res.json({ message: '메뉴가 비활성화되었습니다.' });
  } catch (err) { next(err); }
});

module.exports = router;
