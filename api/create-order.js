// /api/create-order.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { amount, currency } = req.body || {};

    if (!amount || !currency) {
      return res
        .status(400)
        .json({ error: "Missing amount or currency in body" });
    }

    const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
    const MODE = process.env.PAYPAL_MODE === "live" ? "live" : "sandbox";

    if (!CLIENT_ID || !CLIENT_SECRET) {
      console.error("Missing PayPal env vars");
      return res
        .status(500)
        .json({ error: "Missing PayPal credentials on server" });
    }

    const baseUrl =
      MODE === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";

    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

    // 1) Get access token
    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const tokenText = await tokenResponse.text();

    if (!tokenResponse.ok) {
      console.error("PayPal token error:", tokenResponse.status, tokenText);
      return res.status(500).json({
        error: "Failed to get access token",
        details: tokenText,
      });
    }

    const tokenData = JSON.parse(tokenText);
    const accessToken = tokenData.access_token;

    // 2) Create order
    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
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
          return_url:
            "https://juvalixpro-payments-backend.vercel.app/success.html",
          cancel_url:
            "https://juvalixpro-payments-backend.vercel.app/cancel.html",
        },
      }),
    });

    const orderText = await orderResponse.text();

    if (!orderResponse.ok) {
      console.error("PayPal create order error:", orderResponse.status, orderText);
      return res.status(500).json({
        error: "Failed to create PayPal order",
        details: orderText,
      });
    }

    const orderData = JSON.parse(orderText);
    const approveLink =
      (orderData.links || []).find((x) => x.rel === "approve") || null;

    if (!approveLink) {
      console.error("No approve link in order:", orderData);
      return res
        .status(500)
        .json({ error: "No approval link returned from PayPal" });
    }

    return res.status(200).json({
      approvalUrl: approveLink.href,
      orderId: orderData.id,
    });
  } catch (err) {
    console.error("Unhandled PayPal error:", err);
    return res.status(500).json({
      error: "Server exception in create-order",
      details: String(err),
    });
  }
}
