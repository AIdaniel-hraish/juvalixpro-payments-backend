import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, currency } = req.body;

  // PayPal Keys from Vercel Environment Variables
  const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
  const SECRET = process.env.PAYPAL_SECRET;

  const auth = Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64');

  try {
    // 1) Get Access Token
    const tokenResponse = await fetch(
      "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      }
    );

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2) Create Order
    const orderResponse = await fetch(
      "https://api-m.sandbox.paypal.com/v2/checkout/orders",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: currency,
                value: amount,
              },
            },
          ],
          application_context: {
            brand_name: "JuvalixPro",
            return_url: "https://juvalixpro-payments-backend.vercel.app/success",
            cancel_url: "https://juvalixpro-payments-backend.vercel.app/cancel",
          },
        }),
      }
    );

    const orderData = await orderResponse.json();

    return res.status(200).json({
      approvalUrl: orderData.links.find((x) => x.rel === "approve").href,
      orderId: orderData.id,
    });

  } catch (error) {
    console.error("PayPal error:", error);
    return res.status(500).json({ error: "PayPal order creation failed" });
  }
}
