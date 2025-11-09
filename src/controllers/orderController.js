// src/controllers/orderController.js
const pool = require('../db/config');
const { chargePayment } = require('../clients/paymentClient'); // Payment client
const { getMenuItems } = require('../clients/restaurantClient'); // Restaurant Service client

// Helper to round to 2 decimals
const money = n => Number(Number(n).toFixed(2));

async function createOrder(req, res) {
  const client = await pool.connect();
  try {
    const { customer_id, restaurant_id, address_id, items = [], client_total } = req.body || {};

    // Basic validations
    if (!customer_id || !restaurant_id || !address_id) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'customer_id, restaurant_id, address_id required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'items required' });
    }
    if (items.length > 20) {
      return res.status(400).json({ code: 'BUSINESS_RULE', message: 'Max 20 items per order' });
    }

    // ✅ Fetch live menu items from Restaurant Service
    const menuItems = await getMenuItems(restaurant_id);
    if (!menuItems || menuItems.length === 0) {
      return res.status(400).json({ code: 'BUSINESS_RULE', message: `Restaurant ${restaurant_id} is closed or has no menu` });
    }

    // Build a map for quick availability check
    const availableItemsMap = {};
    menuItems.forEach(item => {
      availableItemsMap[item.item_id] = item.is_available;
    });

    // Validate each item quantity and availability
    for (const it of items) {
      const quantity = Number(it.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
        return res.status(400).json({ code: 'BUSINESS_RULE', message: 'Each line quantity must be 1..5' });
      }

      const itemId = it.menu_item_id; // payload uses menu_item_id
      if (!availableItemsMap.hasOwnProperty(itemId)) {
        return res.status(400).json({ code: 'BUSINESS_RULE', message: `Item ${itemId} does not exist in restaurant ${restaurant_id}` });
      }
      if (!availableItemsMap[itemId]) {
        return res.status(400).json({ code: 'BUSINESS_RULE', message: `Item ${itemId} is unavailable` });
      }

      it.item_id = itemId; // map menu_item_id -> item_id for DB insert
    }

    // Calculate totals
    const subtotal = items.reduce((s, it) => s + Number(it.price) * Number(it.quantity), 0);
    const tax = money(subtotal * 0.05);
    const delivery_fee = 30; // ₹30
    const order_total = money(subtotal + tax + delivery_fee);

    // Validate client total
    if (client_total && money(client_total) !== order_total) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Client total does not match server calculation' });
    }

    // Insert order into DB
    await client.query('BEGIN');

    const orderRow = await client.query(
      `INSERT INTO orders 
        (customer_id, restaurant_id, address_id, order_status, order_total, tax, delivery_fee, payment_status)
       VALUES ($1,$2,$3,'CREATED',$4,$5,$6,'PENDING') RETURNING *`,
      [customer_id, restaurant_id, address_id, order_total, tax, delivery_fee]
    );

    const order_id = orderRow.rows[0].order_id;

    const sqlItem = `INSERT INTO order_items (order_id, item_id, quantity, price) VALUES ($1,$2,$3,$4)`;
    for (const it of items) {
      await client.query(sqlItem, [order_id, it.item_id, it.quantity, it.price]);
    }

    await client.query('COMMIT');
    client.release();

    // ✅ Call Payment Service after commit
    let paymentStatus = 'PAYMENT_FAILED';
    let paymentResponse = null;
    try {
      paymentResponse = await chargePayment(order_id, order_total);
      if (paymentResponse.payment?.status === 'SUCCESS') {
        paymentStatus = 'PAID';
      }
    } catch (err) {
      console.error('Payment failed for order', order_id, err.response?.data || err.message);
      paymentResponse = { error: err.response?.data || err.message };
    }

    // Update order with payment status
    await pool.query('UPDATE orders SET payment_status=$1 WHERE order_id=$2', [paymentStatus, order_id]);

    return res.status(201).json({
      order_id,
      order_total,
      payment_status: paymentStatus,
      payment: paymentResponse
    });

  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    console.error(e);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: e.message });
  }
}

async function listOrders(req, res) {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
  const offset = (page - 1) * limit;

  try {
    const { rows } = await pool.query(
      'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    res.json({ page, limit, total: rows.length, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: e.message });
  }
}

async function getOrder(req, res) {
  const { order_id } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM orders WHERE order_id=$1',
      [order_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ code: 'NOT_FOUND', message: `Order ${order_id} not found` });
    }

    const { rows: items } = await pool.query(
      'SELECT * FROM order_items WHERE order_id=$1',
      [order_id]
    );

    res.json({ ...rows[0], items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: e.message });
  }
}

async function updateOrderStatus(req, res) {
  const { order_id } = req.params;
  const { order_status, payment_status } = req.body || {};

  if (!order_status && !payment_status) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Provide order_status or payment_status to update' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM orders WHERE order_id=$1', [order_id]);
    if (rows.length === 0) {
      return res.status(404).json({ code: 'NOT_FOUND', message: `Order ${order_id} not found` });
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (order_status) {
      updates.push(`order_status=$${idx++}`);
      values.push(order_status);
    }
    if (payment_status) {
      updates.push(`payment_status=$${idx++}`);
      values.push(payment_status);
    }
    values.push(order_id);

    const sql = `UPDATE orders SET ${updates.join(', ')} WHERE order_id=$${idx} RETURNING *`;
    const { rows: updatedRows } = await pool.query(sql, values);

    res.json(updatedRows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: e.message });
  }
}

module.exports = { createOrder, listOrders, getOrder, updateOrderStatus };
