const router = require('express').Router();
const db = require('../db');
const { deductInventory }   = require('../services/inventoryService');
const { earnPoints }        = require('../services/membershipService');

// POST /api/payments — 결제 처리 (핵심 엔드포인트)
router.post('/', async (req, res, next) => {
  try {
    const {
      order_id, branch_id, method, total_amount,
      cash_amount, cash_received, card_amount,
      card_approval_no, card_company, card_last4,
      points_used, coupon_id, member_id, discount_amount,
      staff_id, split_payments: splits
    } = req.body;

    if (!order_id || !total_amount) {
      return res.status(400).json({ error: '주문 ID와 결제금액이 필요합니다.' });
    }

    const { withTransaction } = require('../db');

    const payment = await withTransaction(async (client) => {
      // 1. 결제 레코드 생성
      const payResult = await client.query(
        `INSERT INTO payments
           (order_id, branch_id, method, total_amount,
            cash_amount, cash_received, card_amount,
            card_approval_no, card_company, card_last4,
            points_used, coupon_id, member_id, discount_amount, staff_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [order_id, branch_id, method, total_amount,
         cash_amount || 0, cash_received || 0, card_amount || 0,
         card_approval_no || null, card_company || null, card_last4 || null,
         points_used || 0, coupon_id || null, member_id || null,
         discount_amount || 0, staff_id || null]
      );
      const payment = payResult.rows[0];

      // 2. 분할 결제 상세 저장
      if (splits && splits.length > 0) {
        for (const sp of splits) {
          await client.query(
            `INSERT INTO split_payments (payment_id, method, amount, card_approval_no)
             VALUES ($1,$2,$3,$4)`,
            [payment.id, sp.method, sp.amount, sp.card_approval_no || null]
          );
        }
      }

      // 3. 주문 상태 → paid
      await client.query(
        `UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1`,
        [order_id]
      );

      // 4. 테이블 상태 → empty
      const orderRes = await client.query(
        `SELECT table_id FROM orders WHERE id = $1`, [order_id]
      );
      if (orderRes.rows[0]?.table_id) {
        await client.query(
          `UPDATE tables SET status = 'empty', current_order_id = NULL WHERE id = $1`,
          [orderRes.rows[0].table_id]
        );
      }

      return payment;
    });

    // 5. 결제 완료 후 비동기 병렬 처리 (재고 차감 + 멤버십 포인트 적립)
    const orderItemsResult = await db.query(
      `SELECT oi.menu_id, oi.qty FROM order_items oi WHERE oi.order_id = $1`,
      [order_id]
    );
    const orderItems = orderItemsResult.rows;

    // 병렬 처리 (실패해도 결제는 완료 처리)
    Promise.allSettled([
      deductInventory(branch_id, orderItems),
      member_id ? earnPoints(member_id, order_id, total_amount) : Promise.resolve()
    ]).then(results => {
      results.forEach(r => {
        if (r.status === 'rejected') {
          console.error('[비동기 처리 실패]', r.reason);
        }
      });
    });

    // WebSocket 브로드캐스트
    const io = req.app.get('io');
    io.to(`branch-${branch_id}`).emit('payment-completed', {
      order_id, payment_id: payment.id, table_id: payment.table_id
    });

    res.status(201).json({
      payment,
      change: method === 'cash' ? (cash_received || 0) - total_amount : 0,
      message: '결제 완료'
    });
  } catch (err) { next(err); }
});

// GET /api/payments?branch_id=1&date=2026-04-22
router.get('/', async (req, res, next) => {
  try {
    const { branch_id, date } = req.query;
    const params = [branch_id];
    let dateFilter = '';
    if (date) {
      dateFilter = `AND DATE(p.created_at AT TIME ZONE 'Asia/Seoul') = $2`;
      params.push(date);
    }
    const result = await db.query(
      `SELECT p.*, o.table_id, t.table_no
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       LEFT JOIN tables t ON t.id = o.table_id
       WHERE p.branch_id = $1 ${dateFilter} AND p.is_cancelled = false
       ORDER BY p.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/payments/:id/cancel — 결제 취소
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE payments SET is_cancelled = true, cancelled_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: '결제 정보를 찾을 수 없습니다.' });

    // 주문 상태 복구
    await db.query(
      `UPDATE orders SET status = 'pending', updated_at = NOW() WHERE id = $1`,
      [result.rows[0].order_id]
    );
    res.json({ message: '결제 취소 완료', payment: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
