const pool = require('../db/config');
const Order = require('../models/order');
const OrderItem = require('../models/orderItem');

// Helper to round to 2 decimals
const money = n => Number(Number(n).toFixed(2));

class OrderService {

  static async createOrder({ customer_id, restaurant_id, address_id, items }) {
    if (!items || items.length === 0 || items.length > 20)
      throw new Error('Items must be 1-20 per order');

    // Validate quantity
    for (const it of items) {
      if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 5)
        throw new Error('Each line quantity must be 1..5');
    }

    // Calculate totals
    const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
    const tax = money(subtotal * 0.05);
    const delivery_fee = 30;
    const order_total = money(subtotal + tax + delivery_fee);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO orders (customer_id, restaurant_id, address_id, order_status, payment_status, order_total, tax, delivery_fee)
         VALUES ($1,$2,$3,'CREATED','PENDING',$4,$5,$6) RETURNING *`,
        [customer_id, restaurant_id, address_id, order_total, tax, delivery_fee]
      );

      const order_id = rows[0].order_id;

      for (const it of items) {
        await OrderItem.addItem({ order_id, ...it });
      }

      await client.query('COMMIT');

      return { order_id, order_total, tax, delivery_fee };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async getOrder(order_id) {
    const order = await Order.getById(order_id);
    if (!order) return null;
    const items = await OrderItem.getByOrderId(order_id);
    return { ...order, items };
  }

  static async listOrders({ page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    return await Order.list({ limit, offset });
  }

  static async updateOrderStatus(order_id, { order_status, payment_status }) {
    return await Order.updateStatuses(order_id, { order_status, payment_status });
  }
}

module.exports = OrderService;
