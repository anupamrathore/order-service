const axios = require('axios');

const RESTAURANT_SERVICE_URL = process.env.RESTAURANT_SERVICE_URL || 'http://localhost:3002/v1';

async function getMenuItems(restaurantId) {
  try {
    const response = await axios.get(`${RESTAURANT_SERVICE_URL}/restaurants/${restaurantId}/menu-items`);
    return response.data; // array of menu items
  } catch (err) {
    console.error('Error fetching menu items from restaurant service:', err.message);
    throw new Error('Failed to fetch menu items');
  }
}

module.exports = { getMenuItems };
