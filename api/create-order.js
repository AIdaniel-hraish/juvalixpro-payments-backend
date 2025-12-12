import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { amount, currency } = req.body || {};

    if (!amount || !currency) {
      return res.status(400).json({
        error: "Missing amount or currency"
      });
    }

    const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({ error: "Missing PayPal credentials" });
    }

    // LIVE URL
    const baseUrl = "https://api-m.paypal.com";

    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

    // 1) Get Access Token (LIVE)
    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    const tokenText = await tokenResponse.text();

    if (!tokenResponse.ok) {
      return res.status(500).json({
        error: "Failed to get PayPal token (LIVE)",
        details: tokenText
      });
    }

    const { access_token } = JSON.parse(tokenText);

    // 2) Create Order (LIVE)
    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount
            }
          }
        ],
        application_context: {
          return_url: "https://juvalixpro-payments.vercel.app/success.html",
          cancel_url: "https://juvalixpro-payments.vercel.app/cancel.html",
          brand_name: "Juvalix Pro"
        }
      })
    });

    const orderText = await orderResponse.text();

    if (!orderResponse.ok) {
      return res.status(500).json({
        error: "Failed to create PayPal order (LIVE)",
        details: orderText
      });
    }

    const orderData = JSON.parse(orderText);
    const approve = orderData.links.find((l) => l.rel === "approve");

    if (!approve) {
      return res.status(500).json({
        error: "No approval URL found",
        details: orderData
      });
    }

    return res.status(200).json({
      approvalUrl: approve.href,
      orderId: orderData.id
    });

  } catch (err) {
    return res.status(500).json({
      error: "Server crash in create-order",
      details: String(err)
    });
  }
}
