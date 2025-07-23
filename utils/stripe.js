const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createCheckoutSessionForUser(userId, priceId) {
    const customer = await stripe.customers.create({
        metadata: { discord_id: userId }
    });

    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customer.id,
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: userId,
        metadata: { discord_id: userId },
        subscription_data: {
            metadata: { discord_id: userId }
        },
        allow_promotion_codes: true,
        success_url: 'https://discord.com',
        cancel_url: 'https://discord.com',
    });

    return session.url;
}

module.exports = { createCheckoutSessionForUser };