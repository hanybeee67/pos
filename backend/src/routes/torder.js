const router = require('express').Router();
const db = require('../db');

// POST /api/torder/order — T-Order 주문 수신 엔드포인트
// T-Order에서 손님 주문 발생 시 이 엔드포인트로 POST
router.post('/order', async (req, res, next) => {
  try {
    // T-Order Channel API Key 인증
    const channelKey = req.headers['x-channel-api-key'];
    if (channelKey && channelKey !== process.env.TORDER_CHANNEL_API_KEY) {
      return res.status(401).json({ error: 'Invalid Channel API Key' });
    }

    const torderData = req.body;
    console.log('[T-Order] 주문 수신:', JSON.stringify(torderData).substring(0, 200));

    // T-Order JSON → 자체 주문 포맷 변환
    // (T-Order 실제 스펙에 맞춰 파싱 로직 수정 필요)
    const branchId   = torderData.store_id  || torderData.branch_id;
    const tableNo    = torderData.table_no  || torderData.table_id;
    const torderItems = torderData.items    || torderData.order_items || [];

    // 테이블 ID 조회
    const tableResult = await db.query(
      `SELECT id FROM tables WHERE branch_id = $1 AND table_no = $2`,
      [branchId, String(tableNo)]
    );
    const tableId = tableResult.rows[0]?.id || null;

    // 메뉴 ID 매핑 (T-Order 메뉴 ID → 자체 메뉴 ID)
    const mappedItems = [];
    for (const ti of torderItems) {
      const menuRes = await db.query(
        `SELECT id, price FROM menus WHERE id = $1 AND is_active = true`,
        [ti.menu_id || ti.item_id]
      );
      if (menuRes.rows.length) {
        mappedItems.push({
          menu_id: menuRes.rows[0].id,
          qty:     ti.qty || ti.quantity || 1,
          note:    ti.note || ti.request || ''
        });
      }
    }

    if (mappedItems.length === 0) {
      return res.status(400).json({ error: '유효한 메뉴 항목이 없습니다.' });
    }

    // 자체 주문 생성 (T-Order 소스)
    const { withTransaction } = require('../db');
    const order = await withTransaction(async (client) => {
      const orderResult = await client.query(
        `INSERT INTO orders
           (branch_id, table_id, order_type, source, person_count, status)
         VALUES ($1, $2, 'dine-in', 'torder', 1, 'pending') RETURNING *`,
        [branchId, tableId]
      );
      const order = orderResult.rows[0];

      for (const item of mappedItems) {
        const menuRes = await client.query(`SELECT price FROM menus WHERE id = $1`, [item.menu_id]);
        await client.query(
          `INSERT INTO order_items (order_id, menu_id, qty, unit_price, note)
           VALUES ($1,$2,$3,$4,$5)`,
          [order.id, item.menu_id, item.qty, menuRes.rows[0].price, item.note]
        );
      }

      if (tableId) {
        await client.query(
          `UPDATE tables SET status = 'occupied', current_order_id = $2 WHERE id = $1`,
          [tableId, order.id]
        );
      }

      return order;
    });

    // WebSocket으로 주방·바 화면에 주문 브로드캐스트
    const io = req.app.get('io');
    io.to(`branch-${branchId}`).emit('torder-received', {
      order_id: order.id,
      table_no: tableNo,
      items: mappedItems
    });

    // T-Order에 성공 응답 (T-Order 스펙에 맞는 응답 형식)
    res.json({
      result:   'success',
      order_id: order.id,
      message:  '주문이 접수되었습니다.'
    });
  } catch (err) {
    console.error('[T-Order] 오류:', err.message);
    next(err);
  }
});

module.exports = router;
