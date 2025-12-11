// /api/capture-order.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { orderId } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ error: "Missing orderId in body" });
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

    const basicAuth = Buffer.from(
      `${CLIENT_ID}:${CLIENT_SECRET}`
    ).toString("base64");

    // 1) token
    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
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

    const { access_token } = JSON.parse(tokenText);

    // 2) capture
    const captureResponse = await fetch(
      `${baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const captureText = await captureResponse.text();

    if (!captureResponse.ok) {
      console.error(
        "PayPal capture error:",
        captureResponse.status,
        captureText
      );
      return res.status(500).json({
        error: "Failed to capture order",
        details: captureText,
      });
    }

    const captureData = JSON.parse(captureText);

    return res.status(200).json({
      message: "Order captured successfully",
      details: captureData,
    });
  } catch (err) {
    console.error("Unhandled capture error:", err);
    return res.status(500).json({
      error: "Server exception in capture-order",
      details: String(err),
    });
  }
}
