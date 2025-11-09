const axios = require('axios');

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004/v1';

async function chargePayment(order_id, amount, currency = 'INR') {
  try {
    const idempotencyKey = `order-${order_id}-${Date.now()}`;

    const response = await axios.post(
      `${PAYMENT_SERVICE_URL}/payments/charge`,
      {
        order_id,
        amount,
        currency,
        payment_method: 'CARD' // or you can make this dynamic
      },
      {
        headers: { 'Idempotency-Key': idempotencyKey }
      }
    );

    return response.data;
  } catch (err) {
    console.error('Payment Client Error:', err.response?.data || err.message);
    throw err;
  }
}

module.exports = { chargePayment };
