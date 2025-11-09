const pool = require('../db/config');

class Order {
  static async getById(order_id) {
    const { rows } = await pool.query('SELECT * FROM orders WHERE order_id = $1', [order_id]);
    return rows[0];
  }

  static async list({ limit = 20, offset = 0 }) {
    const { rows } = await pool.query(
      'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return rows;
  }

  static async updateStatuses(order_id, { order_status, payment_status }) {
    const { rows } = await pool.query(
      `UPDATE orders
       SET order_status = COALESCE($2, order_status),
           payment_status = COALESCE($3, payment_status)
       WHERE order_id = $1
       RETURNING *`,
      [order_id, order_status || null, payment_status || null]
    );
    return rows[0];
  }
}

module.exports = Order;
