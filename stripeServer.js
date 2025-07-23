require('dotenv').config({ quiet: true });
const express = require('express');
const app = express();
const stripeWebhook = require('./stripeWebhook');
const db = require('./db');

(async () => {
    try {
        const result = await db.query('SELECT NOW()');
        console.log('✅ Database connected! Time:', result.rows[0].now);
    } catch (err) {
        console.error('❌ Database connection failed:', err);
    }
})();

app.use('/webhook', stripeWebhook);
app.listen(3000, () => console.log('Webhook server running on port 3000'));