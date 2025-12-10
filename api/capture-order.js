import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: "Missing orderId" });
  }

  // PayPal credentials from Vercel Environment Variables
  const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
  const SECRET = process.env.PAYPAL_CLIENT_SECRET;
  const MODE = process.env.PAYPAL_MODE || "live"; // live or sandbox

  // Correct PayPal Base URL
  const BASE_URL =
    MODE === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

  // Generate Access Token
  const basicAuth = Buffer.from(`${CLIENT_ID}:${SECRET}`).toString("base64");

  try {
    // 1) GET ACCESS TOKEN
    const tokenResponse = await fetch(`${BASE_URL}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return res.status(500).json({
        error: "Failed to get access token",
        details: tokenData,
      });
    }

    const accessToken = tokenData.access_token;

    // 2) CAPTURE ORDER
    const captureResponse = await fetch(
      `${BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const captureData = await captureResponse.json();

    if (!captureResponse.ok) {
      return res.status(500).json({
        error: "Failed to capture order",
        details: captureData,
      });
    }

    return res.status(200).json({
      message: "Order captured successfully",
      details: captureData,
    });
  } catch (error) {
    console.error("CAPTURE ERROR:", error);
    return res.status(500).json({
      error: "Unexpected error while capturing order",
      details: error.toString(),
    });
  }
}
