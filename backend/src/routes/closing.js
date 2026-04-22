const router = require('express').Router();
const db = require('../db');
const { sendDailySales } = require('../services/revenueService');

// POST /api/closing/daily — 일 마감
router.post('/daily', async (req, res, next) => {
  try {
    const { branch_id, date, staff_id } = req.body;

    if (!branch_id || !date) {
      return res.status(400).json({ error: '지점 ID와 날짜가 필요합니다.' });
    }

    // 해당 날짜 결제 집계
    const summaryResult = await db.query(
      `SELECT
         COUNT(DISTINCT p.order_id)                              as order_count,
         COALESCE(SUM(p.total_amount), 0)                       as total_amount,
         COALESCE(SUM(p.cash_amount), 0)                        as cash_amount,
         COALESCE(SUM(p.card_amount), 0)                        as card_amount,
         COALESCE(SUM(o.person_count), 0)                       as person_count
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE p.branch_id = $1
         AND DATE(p.created_at AT TIME ZONE 'Asia/Seoul') = $2
         AND p.is_cancelled = false`,
      [branch_id, date]
    );

    // 카테고리별 매출 집계
    const catResult = await db.query(
      `SELECT c.name_ko as category,
              SUM(oi.qty * oi.unit_price) as amount
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN menus m ON m.id = oi.menu_id
       JOIN categories c ON c.id = m.category_id
       WHERE p.branch_id = $1
         AND DATE(p.created_at AT TIME ZONE 'Asia/Seoul') = $2
         AND p.is_cancelled = false
       GROUP BY c.name_ko`,
      [branch_id, date]
    );

    const summary  = summaryResult.rows[0];
    const byCategory = {};
    catResult.rows.forEach(r => { byCategory[r.category] = parseInt(r.amount); });

    const closingData = {
      branch_id:    parseInt(branch_id),
      date,
      total_amount: parseInt(summary.total_amount),
      cash_amount:  parseInt(summary.cash_amount),
      card_amount:  parseInt(summary.card_amount),
      order_count:  parseInt(summary.order_count),
      person_count: parseInt(summary.person_count),
      by_category:  byCategory
    };

    // daily_sales 테이블에 upsert
    await db.query(
      `INSERT INTO daily_sales
         (branch_id, date, total_amount, cash_amount, card_amount,
          order_count, person_count, by_category, closed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (branch_id, date) DO UPDATE SET
         total_amount = EXCLUDED.total_amount,
         cash_amount  = EXCLUDED.cash_amount,
         card_amount  = EXCLUDED.card_amount,
         order_count  = EXCLUDED.order_count,
         person_count = EXCLUDED.person_count,
         by_category  = EXCLUDED.by_category,
         closed_by    = EXCLUDED.closed_by`,
      [branch_id, date, closingData.total_amount, closingData.cash_amount,
       closingData.card_amount, closingData.order_count,
       closingData.person_count, JSON.stringify(byCategory), staff_id || null]
    );

    // 재무관리 시스템으로 자동 전송
    const revenueResult = await sendDailySales(closingData);
    const syncOk = !revenueResult?.error;

    if (syncOk) {
      await db.query(
        `UPDATE daily_sales SET is_synced_revenue = true, synced_at = NOW()
         WHERE branch_id = $1 AND date = $2`,
        [branch_id, date]
      );
    }

    res.json({
      message: `${date} 일 마감 완료`,
      summary: closingData,
      revenue_synced: syncOk
    });
  } catch (err) { next(err); }
});

// GET /api/closing/history?branch_id=1&limit=30
router.get('/history', async (req, res, next) => {
  try {
    const { branch_id, limit } = req.query;
    const result = await db.query(
      `SELECT ds.*, s.name_ko as closed_by_name
       FROM daily_sales ds
       LEFT JOIN staff s ON s.id = ds.closed_by
       WHERE ds.branch_id = $1
       ORDER BY ds.date DESC
       LIMIT $2`,
      [branch_id, parseInt(limit) || 30]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

module.exports = router;
