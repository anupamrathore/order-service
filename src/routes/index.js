// src/routes/index.js
const express = require('express');
const { createOrder, getOrder, listOrders, updateOrderStatus } = require('../controllers/orderController');

const router = express.Router();

router.get('/healthz', (req, res) => res.json({ status: 'ok' }));

router.post('/orders', createOrder);
router.get('/orders', listOrders);
router.get('/orders/:order_id', getOrder);
router.patch('/orders/:order_id', updateOrderStatus);

module.exports = router;
