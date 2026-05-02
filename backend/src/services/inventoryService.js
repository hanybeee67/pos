const axios = require('axios');
const db     = require('../db');

const INVENTORY_URL = process.env.INVENTORY_API_URL || 'https://everest-inventory.onrender.com';
const INTERNAL_KEY  = process.env.INTERNAL_API_KEY  || '';

/**
 * 판매 완료 후 재고 자동 차감
 * 재고관리 앱의 deduct_by_menu(menu_name, qty, branch)를 직접 호출.
 * 레시피 조회 + 차감이 재고앱 내부에서 한 번에 처리됨.
 *
 * POST /api/inventory/out
 * body: { branch_id, items: [{item_id: "메뉴명", qty}], source: 'pos' }
 */
async function deductInventory(branchId, orderItems) {
  try {
    // 메뉴 ID → 메뉴명(name_ko) 변환
    const deductItems = [];
    for (const oi of orderItems) {
      const menuRes = await db.query(
        `SELECT name_ko FROM menus WHERE id = $1`,
        [oi.menu_id]
      );
      if (!menuRes.rows.length) {
        console.warn(`[재고] 메뉴 ID ${oi.menu_id} 없음, 스킵`);
        continue;
      }
      deductItems.push({
        item_id: menuRes.rows[0].name_ko,  // 재고앱은 메뉴명으로 레시피 조회
        qty:     oi.qty,
        note:    'POS 판매 자동차감'
      });
    }

    if (deductItems.length === 0) return { skipped: true, reason: '처리할 메뉴 없음' };

    const res = await axios.post(`${INVENTORY_URL}/api/inventory/out`, {
      branch_id: branchId,
      items:     deductItems,
      source:    'pos'
    }, {
      headers: { 'x-api-key': INTERNAL_KEY },
      timeout: 8000
    });

    // 재고 부족 알림이 있으면 로그 출력
    if (res.data.alerts && res.data.alerts.length > 0) {
      console.warn(`[재고] ⚠ 재고 부족 알림 branch=${branchId}:`, res.data.alerts);
    }

    console.log(`[재고] 차감 완료 branch=${branchId}, menus=${deductItems.length}개`);
    return res.data;
  } catch (err) {
    console.error('[재고] 차감 실패:', err.message);
    return { error: err.message };
  }
}

/**
 * 재고 부족 품목 조회 (선택적 사용)
 * GET /api/inventory/alerts?branch_id={id}
 */
async function getInventoryAlerts(branchId) {
  try {
    const res = await axios.get(`${INVENTORY_URL}/api/inventory/alerts`, {
      params:  { branch_id: branchId },
      headers: { 'x-api-key': INTERNAL_KEY },
      timeout: 5000
    });
    return res.data; // { low_stock_count, items: [{Item, Category, CurrentQty, MinQty, Unit}] }
  } catch (err) {
    console.error(`[재고] 부족 알림 조회 실패 branch=${branchId}:`, err.message);
    return null;
  }
}

module.exports = { deductInventory, getInventoryAlerts };
