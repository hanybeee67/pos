const axios = require('axios');

const REVENUE_URL  = process.env.REVENUE_API_URL || 'https://everest-finance.onrender.com';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || '';

/**
 * 일 마감 시 재무관리 시스템으로 매출 전송
 * POST /api/revenue/daily
 */
async function sendDailySales(summaryData) {
  try {
    const res = await axios.post(`${REVENUE_URL}/api/revenue/daily`, summaryData, {
      headers: { 'x-api-key': INTERNAL_KEY },
      timeout: 10000
    });
    console.log(`[재무] 일 마감 전송 완료 branch=${summaryData.branch_id}, date=${summaryData.date}`);
    return res.data;
  } catch (err) {
    console.error('[재무] 일 마감 전송 실패:', err.message);
    return { error: err.message };
  }
}

module.exports = { sendDailySales };
