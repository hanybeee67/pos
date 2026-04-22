const axios = require('axios');

const INVENTORY_URL = process.env.INVENTORY_API_URL || 'https://everest-inventory.onrender.com';
const INTERNAL_KEY  = process.env.INTERNAL_API_KEY  || '';

/**
 * 메뉴 레시피 조회 → 재고관리 앱에서 식재료 목록 가져오기
 * GET /api/recipe/ingredients?menuId={id}
 */
async function getRecipeIngredients(menuId) {
  try {
    const res = await axios.get(`${INVENTORY_URL}/api/recipe/ingredients`, {
      params: { menuId },
      headers: { 'x-api-key': INTERNAL_KEY },
      timeout: 5000
    });
    return res.data; // { menu_id, items: [{item_id, name, qty, unit}] }
  } catch (err) {
    console.error(`[재고] 레시피 조회 실패 menuId=${menuId}:`, err.message);
    return null;
  }
}

/**
 * 판매 완료 후 식재료 자동 차감
 * POST /api/inventory/out
 * body: { branch_id, items: [{item_id, qty, note}], source: 'pos' }
 */
async function deductInventory(branchId, orderItems) {
  try {
    // 각 메뉴별 레시피 조회 후 차감 아이템 목록 구성
    const deductItems = [];
    for (const oi of orderItems) {
      const recipe = await getRecipeIngredients(oi.menu_id);
      if (!recipe || !recipe.items) continue;
      for (const ing of recipe.items) {
        const existing = deductItems.find(d => d.item_id === ing.item_id);
        if (existing) {
          existing.qty += ing.qty * oi.qty;
        } else {
          deductItems.push({
            item_id: ing.item_id,
            qty: ing.qty * oi.qty,
            note: `POS 판매 자동차감`
          });
        }
      }
    }

    if (deductItems.length === 0) return { skipped: true, reason: '레시피 없음' };

    const res = await axios.post(`${INVENTORY_URL}/api/inventory/out`, {
      branch_id: branchId,
      items: deductItems,
      source: 'pos'
    }, {
      headers: { 'x-api-key': INTERNAL_KEY },
      timeout: 8000
    });

    console.log(`[재고] 차감 완료 branch=${branchId}, items=${deductItems.length}`);
    return res.data;
  } catch (err) {
    console.error('[재고] 차감 실패:', err.message);
    return { error: err.message };
  }
}

module.exports = { getRecipeIngredients, deductInventory };
