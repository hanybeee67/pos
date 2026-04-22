const router = require('express').Router();
const db = require('../db');

// GET /api/orders?branch_id=1&date=2026-04-22&status=pending
router.get('/', async (req, res, next) => {
  try {
    const { branch_id, date, status } = req.query;
    let whereClause = 'WHERE o.branch_id = $1';
    const params = [branch_id];
    let paramIdx = 2;

    if (date) {
      whereClause += ` AND DATE(o.created_at AT TIME ZONE 'Asia/Seoul') = $${paramIdx}`;
      params.push(date);
      paramIdx++;
    }
    if (status) {
      whereClause += ` AND o.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    const result = await db.query(
      `SELECT o.*,
              t.table_no,
              s.name_ko   as staff_name,
              json_agg(
                json_build_object(
                  'id',         oi.id,
                  'menu_id',    oi.menu_id,
                  'name_ko',    m.name_ko,
                  'qty',        oi.qty,
                  'unit_price', oi.unit_price,
                  'note',       oi.note,
                  'status',     oi.status
                ) ORDER BY oi.id
              ) FILTER (WHERE oi.id IS NOT NULL) as items
       FROM orders o
       LEFT JOIN tables t  ON t.id  = o.table_id
       LEFT JOIN staff  s  ON s.id  = o.staff_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menus m ON m.id = oi.menu_id
       ${whereClause}
       GROUP BY o.id, t.table_no, s.name_ko
       ORDER BY o.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/orders — 주문 생성
router.post('/', async (req, res, next) => {
  try {
    const { branch_id, table_id, order_type, source, person_count, note, staff_id, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: '주문 항목이 없습니다.' });
    }

    const { withTransaction } = require('../db');

    const order = await withTransaction(async (client) => {
      // 주문 생성
      const orderResult = await client.query(
        `INSERT INTO orders (branch_id, table_id, order_type, source, person_count, note, staff_id, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
        [branch_id, table_id || null, order_type || 'dine-in',
         source || 'pos', person_count || 1, note || '', staff_id || null]
      );
      const order = orderResult.rows[0];

      // 메뉴 단가 검증 후 주문 아이템 삽입
      for (const item of items) {
        const menuRes = await client.query(
          `SELECT price FROM menus WHERE id = $1`, [item.menu_id]
        );
        if (!menuRes.rows.length) throw new Error(`메뉴 ID ${item.menu_id}를 찾을 수 없습니다.`);
        const unit_price = menuRes.rows[0].price;

        await client.query(
          `INSERT INTO order_items (order_id, menu_id, qty, unit_price, options, note)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [order.id, item.menu_id, item.qty, unit_price,
           JSON.stringify(item.options || []), item.note || '']
        );
      }

      // 테이블 상태 → occupied
      if (table_id) {
        await client.query(
          `UPDATE tables SET status = 'occupied', current_order_id = $2 WHERE id = $1`,
          [table_id, order.id]
        );
      }

      return order;
    });

    // 주문 아이템 포함 전체 조회
    const full = await db.query(
      `SELECT o.*, json_agg(
         json_build_object(
           'id', oi.id, 'menu_id', oi.menu_id, 'name_ko', m.name_ko,
           'qty', oi.qty, 'unit_price', oi.unit_price, 'note', oi.note,
           'printer_target', m.printer_target
         ) ORDER BY oi.id
       ) as items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menus m ON m.id = oi.menu_id
       WHERE o.id = $1 GROUP BY o.id`,
      [order.id]
    );

    const fullOrder = full.rows[0];
    // WebSocket 브로드캐스트
    const io = req.app.get('io');
    io.to(`branch-${branch_id}`).emit('new-order', fullOrder);

    res.status(201).json(fullOrder);
  } catch (err) { next(err); }
});

// PATCH /api/orders/:id/status — 주문 상태 변경
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await db.query(
      `UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, status]
    );
    const order = result.rows[0];
    const io = req.app.get('io');
    io.to(`branch-${order.branch_id}`).emit('order-updated', order);
    res.json(order);
  } catch (err) { next(err); }
});

// PATCH /api/orders/:id — 주문 아이템 추가(추가 주문)
router.patch('/:id/items', async (req, res, next) => {
  try {
    const { items } = req.body;
    const orderId = req.params.id;
    for (const item of items) {
      const menuRes = await db.query(`SELECT price FROM menus WHERE id = $1`, [item.menu_id]);
      if (!menuRes.rows.length) continue;
      await db.query(
        `INSERT INTO order_items (order_id, menu_id, qty, unit_price, note)
         VALUES ($1,$2,$3,$4,$5)`,
        [orderId, item.menu_id, item.qty, menuRes.rows[0].price, item.note || '']
      );
    }
    const io = req.app.get('io');
    const orderRes = await db.query(`SELECT branch_id FROM orders WHERE id = $1`, [orderId]);
    if (orderRes.rows[0]) {
      io.to(`branch-${orderRes.rows[0].branch_id}`).emit('order-items-added', { order_id: orderId, items });
    }
    res.json({ message: '추가 주문 완료' });
  } catch (err) { next(err); }
});

module.exports = router;
