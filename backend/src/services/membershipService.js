const axios = require('axios');

const MEMBERSHIP_URL = process.env.MEMBERSHIP_API_URL || 'https://everest-ocr.onrender.com';
const INTERNAL_KEY   = process.env.INTERNAL_API_KEY   || '';

function headers() {
  return { 'x-api-key': INTERNAL_KEY };
}

/**
 * 전화번호로 멤버 조회
 * GET /api/membership/check?phone={no}
 */
async function checkMember(phone) {
  try {
    const res = await axios.get(`${MEMBERSHIP_URL}/api/membership/check`, {
      params: { phone },
      headers: headers(),
      timeout: 5000
    });
    return res.data; // { member_id, name, points, coupons: [] }
  } catch (err) {
    console.error('[멤버십] 조회 실패:', err.message);
    return null;
  }
}

/**
 * 결제 완료 후 포인트 적립
 * POST /api/membership/points
 * body: { member_id, order_id, amount, points_earned }
 */
async function earnPoints(memberId, orderId, amount) {
  try {
    // 100원당 1포인트 (10만원 = 1000포인트 = 커리 무료)
    const pointsEarned = Math.floor(amount / 100);
    const res = await axios.post(`${MEMBERSHIP_URL}/api/membership/points`, {
      member_id:     memberId,
      order_id:      orderId,
      amount:        amount,
      points_earned: pointsEarned
    }, {
      headers: headers(),
      timeout: 5000
    });
    console.log(`[멤버십] 포인트 적립 member=${memberId}, +${pointsEarned}pt`);
    return res.data;
  } catch (err) {
    console.error('[멤버십] 포인트 적립 실패:', err.message);
    return { error: err.message };
  }
}

/**
 * 포인트·쿠폰 차감
 * POST /api/membership/redeem
 * body: { member_id, order_id, points_used, coupon_id }
 */
async function redeemPoints(memberId, orderId, pointsUsed, couponId = null) {
  try {
    const res = await axios.post(`${MEMBERSHIP_URL}/api/membership/redeem`, {
      member_id:   memberId,
      order_id:    orderId,
      points_used: pointsUsed,
      coupon_id:   couponId
    }, {
      headers: headers(),
      timeout: 5000
    });
    console.log(`[멤버십] 포인트 차감 member=${memberId}, -${pointsUsed}pt`);
    return res.data;
  } catch (err) {
    console.error('[멤버십] 포인트 차감 실패:', err.message);
    return { error: err.message };
  }
}

module.exports = { checkMember, earnPoints, redeemPoints };
