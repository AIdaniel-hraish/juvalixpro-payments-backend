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
    const CLIENT_SECRET = process.env.PAYPAL_SECRET;

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({
        error: "Missing PayPal credentials (env missing)"
      });
    }

    const baseUrl = "https://api-m.paypal.com";

    // 1) Get Access Token
    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return res.status(500).json({
        error: "Failed to get PayPal token",
        details: tokenData
      });
    }

    const access_token = tokenData.access_token;

    // 2) Create Order
    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
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
        ]
      })
    });

    const orderData = await orderRes.json();

    if (!orderRes.ok) {
      return res.status(500).json({
        error: "Failed to create order",
        details: orderData
      });
    }

    const approveLink = orderData.links.find((l) => l.rel === "approve");

    return res.status(200).json({
      orderId: orderData.id,
      approvalUrl: approveLink.href
    });

  } catch (err) {
    return res.status(500).json({
      error: "Server crash in create-order",
      details: err.toString()
    });
  }
}

