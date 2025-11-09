const express = require('express');
require('dotenv').config();
const routes = require('./routes');

const app = express();

// Middleware to parse JSON requests
app.use(express.json());

// Base API routes
app.use('/v1', routes);

// Fallback route for undefined endpoints
app.use((req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Endpoint not found' });
});

// Start server on port from .env or 3003, listen on all interfaces
const port = Number(process.env.PORT || 3003);
app.listen(port, '0.0.0.0', () => {
  console.log(`Order Service running on port ${port}`);
});
