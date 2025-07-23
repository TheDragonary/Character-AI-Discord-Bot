const express = require('express');
const router = express.Router();
const db = require('./db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
    console.log('Stripe webhook called');
    const sig = req.headers['stripe-signature'];

    let event = req.body;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('⚠️ Webhook error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const session = event.data.object;
    const discordId = session.metadata?.discord_id;
    console.log(discordId);

    if (!discordId) {
        console.warn('No Discord ID found in metadata');
        return res.sendStatus(200);
    }

    if (event.type === 'checkout.session.completed') {
        const sessionId = session.id;

        const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['line_items']
        });

        const lineItem = checkoutSession.line_items?.data?.[0];
        const productId = lineItem?.price?.product;

        const result = await db.query(`SELECT tier_name FROM tiers WHERE product_id = $1`, [productId]);
        const tierName = result.rows[0]?.tier_name;

        if (!tierName) {
            console.warn('Unknown tier product ID:', productId);
            return res.sendStatus(200);
        }

        await db.query(
            `INSERT INTO user_tiers (user_id, tier_name)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET tier_name = $2`,
            [discordId, tierName]
        );

        console.log(`✅ Assigned tier '${tierName}' to user ${discordId}`);
    }

    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const discordId = subscription.metadata?.discord_id;

        if (!discordId) {
            console.warn('No Discord ID in subscription metadata');
            return res.sendStatus(200);
        }

        await db.query(
            `UPDATE user_tiers SET tier_name = 'free' WHERE user_id = $1`,
            [discordId]
        );

        console.log(`🔻 Downgraded user ${discordId} to free tier`);
    }

    res.status(200).end();
});

module.exports = router;