const router = require('express').Router();
const db = require('../db');

// GET /api/tables?branch_id=1
router.get('/', async (req, res, next) => {
  try {
    const { branch_id } = req.query;
    const result = await db.query(
      `SELECT t.*,
              o.id       as order_id,
              o.status   as order_status,
              o.created_at as order_started,
              (
                SELECT m.name_ko
                FROM order_items oi
                JOIN menus m ON m.id = oi.menu_id
                WHERE oi.order_id = o.id
                ORDER BY oi.id ASC
                LIMIT 1
              ) as first_item_name,
              (
                SELECT oi.qty
                FROM order_items oi
                WHERE oi.order_id = o.id
                ORDER BY oi.id ASC
                LIMIT 1
              ) as first_item_qty,
              (
                SELECT SUM(qty)
                FROM order_items oi
                WHERE oi.order_id = o.id
              ) as total_qty,
              (
                SELECT SUM(oi.unit_price * oi.qty)
                FROM order_items oi
                WHERE oi.order_id = o.id
              ) as total_price
       FROM tables t
       LEFT JOIN orders o ON o.id = t.current_order_id AND o.status NOT IN ('paid','cancelled')
       WHERE t.branch_id = $1
       ORDER BY t.floor, t.table_no`,
      [branch_id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// PATCH /api/tables/:id/status — 테이블 상태 변경
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status, current_order_id } = req.body;
    const result = await db.query(
      `UPDATE tables SET status = $2, current_order_id = $3 WHERE id = $1 RETURNING *`,
      [req.params.id, status, current_order_id || null]
    );
    // WebSocket으로 전 지점 단말에 상태 변경 브로드캐스트
    const table = result.rows[0];
    const io = req.app.get('io');
    io.to(`branch-${table.branch_id}`).emit('table-updated', table);
    res.json(table);
  } catch (err) { next(err); }
});

// POST /api/tables — 테이블 추가 (관리자)
router.post('/', async (req, res, next) => {
  try {
    const { branch_id, table_no, floor, seat_count, pos_x, pos_y } = req.body;
    const result = await db.query(
      `INSERT INTO tables (branch_id, table_no, floor, seat_count, pos_x, pos_y)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [branch_id, table_no, floor || '1층', seat_count || 4, pos_x || 0, pos_y || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/tables/:id — 테이블 정보 수정
router.patch('/:id', async (req, res, next) => {
  try {
    const { table_no, floor, seat_count, pos_x, pos_y } = req.body;
    const result = await db.query(
      `UPDATE tables SET
         table_no   = COALESCE($2, table_no),
         floor      = COALESCE($3, floor),
         seat_count = COALESCE($4, seat_count),
         pos_x      = COALESCE($5, pos_x),
         pos_y      = COALESCE($6, pos_y)
       WHERE id = $1 RETURNING *`,
      [
        req.params.id,
        table_no !== undefined ? table_no : null,
        floor !== undefined ? floor : null,
        seat_count !== undefined ? seat_count : null,
        pos_x !== undefined ? pos_x : null,
        pos_y !== undefined ? pos_y : null
      ]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
