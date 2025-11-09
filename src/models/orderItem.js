const pool = require('../db/config');

class OrderItem {
  static async addItem({ order_id, item_id, quantity, price }) {
    const { rows } = await pool.query(
      `INSERT INTO order_items (order_id, item_id, quantity, price)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [order_id, item_id, quantity, price]
    );
    return rows[0];
  }

  static async getByOrderId(order_id) {
    const { rows } = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY order_item_id',
      [order_id]
    );
    return rows;
  }
}

module.exports = OrderItem;
