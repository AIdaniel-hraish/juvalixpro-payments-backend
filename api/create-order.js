import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { amount, currency } = req.body || {};
    if (!amount || !currency) {
      return res.status(400).json({ error: "Missing amount or currency" });
    }

    const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const CLIENT_SECRET = process.env.PAYPAL_SECRET;
    const MODE = (process.env.PAYPAL_MODE || "live").toLowerCase(); // live | sandbox

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({ error: "Missing PayPal credentials (env missing)" });
    }

    const baseUrl =
      MODE === "sandbox"
        ? "https://api-m.sandbox.paypal.com"
        : "https://api-m.paypal.com";

    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

    // 1) Access Token
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(500).json({ error: "Failed to get PayPal token", details: tokenData });
    }

    const access_token = tokenData.access_token;

    // 2) Create Order
    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: String(currency).toUpperCase(),
              value: String(amount), // ex: "24.00"
            },
          },
        ],
        application_context: {
          return_url: "https://juvalixpro-payments-backend.vercel.app/success.html",
          cancel_url: "https://juvalixpro-payments-backend.vercel.app/cancel.html",
          brand_name: "Juvalix Pro",
          landing_page: "LOGIN",
          user_action: "PAY_NOW",
        },
      }),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      return res.status(500).json({ error: "Failed to create order", details: orderData });
    }

    const approveLink = (orderData.links || []).find((l) => l.rel === "approve");
    if (!approveLink?.href) {
      return res.status(500).json({ error: "Missing approval link from PayPal", details: orderData });
    }

    return res.status(200).json({
      orderId: orderData.id,
      approvalUrl: approveLink.href,
      mode: MODE,
    });
  } catch (err) {
    return res.status(500).json({ error: "Server crash in create-order", details: String(err) });
  }
}
