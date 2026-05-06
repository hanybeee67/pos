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

// GET /api/tables/default-layout?branch_id=3&key=everest_pos_secret_key_2026
// 사진 기준 기본 배치 좌표를 DB에 일괄 저장 (한 번만 실행)
router.get('/default-layout', async (req, res, next) => {
  try {
    const { branch_id, key } = req.query;
    if (key !== 'everest_pos_secret_key_2026') {
      return res.status(403).json({ error: '인증 실패' });
    }

    // 사진 기준 table_no → (pos_x, pos_y) 매핑
    const layout = {
      '06': { x: 20,   y: 20  },
      '05': { x: 20,   y: 120 },
      '04': { x: 20,   y: 220 },
      '03': { x: 20,   y: 320 },
      '02': { x: 20,   y: 420 },
      '01': { x: 20,   y: 520 },

      '08': { x: 200,  y: 20  },
      '07': { x: 200,  y: 150 },
      '10': { x: 360,  y: 20  },
      '09': { x: 360,  y: 150 },

      '35': { x: 520,  y: 20  },
      '33': { x: 520,  y: 150 },
      '34': { x: 680,  y: 20  },
      '32': { x: 680,  y: 150 },

      '31': { x: 840,  y: 20  },
      '29': { x: 840,  y: 150 },
      '27': { x: 840,  y: 280 },
      '30': { x: 1000, y: 20  },
      '28': { x: 1000, y: 150 },
      '26': { x: 1000, y: 280 },

      '테스트': { x: 360, y: 310 },
      '포장':   { x: 520, y: 310 },
      '대기':   { x: 680, y: 310 },

      '25': { x: 360,  y: 440 },
      '24': { x: 520,  y: 440 },
      '23': { x: 680,  y: 440 },
      '22': { x: 840,  y: 440 },
      '21': { x: 1000, y: 440 },
    };

    const tables = await db.query(
      `SELECT id, table_no FROM tables WHERE branch_id = $1`,
      [branch_id]
    );

    let updated = 0;
    for (const row of tables.rows) {
      const pos = layout[row.table_no];
      if (pos) {
        await db.query(
          `UPDATE tables SET pos_x = $1, pos_y = $2 WHERE id = $3`,
          [pos.x, pos.y, row.id]
        );
        updated++;
      }
    }

    res.json({ success: true, updated, message: `${updated}개 테이블 위치 초기화 완료` });
  } catch (err) { next(err); }
});

// PATCH /api/tables/:id — 테이블 정보 수정
router.patch('/:id', async (req, res, next) => {
  try {
    const { table_no, floor, seat_count, pos_x, pos_y } = req.body;
    const updates = [];
    const values = [req.params.id];
    let idx = 2;

    if (table_no !== undefined) { updates.push(`table_no = $${idx++}`); values.push(table_no); }
    if (floor !== undefined) { updates.push(`floor = $${idx++}`); values.push(floor); }
    if (seat_count !== undefined) { updates.push(`seat_count = $${idx++}`); values.push(seat_count); }
    if (pos_x !== undefined) { updates.push(`pos_x = $${idx++}`); values.push(pos_x); }
    if (pos_y !== undefined) { updates.push(`pos_y = $${idx++}`); values.push(pos_y); }

    if (updates.length === 0) return res.json({});

    const result = await db.query(
      `UPDATE tables SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    res.json(result.rows[0] || {});
  } catch (err) { next(err); }
});

module.exports = router;
