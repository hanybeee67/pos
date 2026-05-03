const axios = require('axios');
axios.post('http://localhost:3000/api/payments', {
  order_id: 1, 
  branch_id: 1, 
  method: 'cash', 
  total_amount: 10000, 
  cash_amount: 10000, 
  cash_received: 10000, 
  points_used: 0, 
  discount_amount: 0
}).then(r => console.log('결과:', r.data))
  .catch(e => console.error('에러:', e.response ? e.response.data : e.message));
