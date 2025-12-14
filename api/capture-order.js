import fetch from "node-fetch";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: "Missing orderId" });

    const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const CLIENT_SECRET = process.env.PAYPAL_SECRET;
    const MODE = (process.env.PAYPAL_MODE || "live").toLowerCase();

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({ error: "Missing PayPal credentials (env)" });
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
      return res.status(500).json({ error: "Failed to get token", details: tokenData });
    }
    const access_token = tokenData.access_token;

    // 2) Capture (idempotency)
    const requestId = crypto.randomUUID();

    const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": requestId,
      },
    });

    const captureData = await captureRes.json();

    if (!captureRes.ok) {
      return res.status(500).json({
        error: "Failed to capture order",
        details: captureData,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Payment captured successfully",
      details: captureData,
      mode: MODE,
    });
  } catch (err) {
    return res.status(500).json({ error: "Server crash", details: String(err) });
  }
}
