import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { orderId } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ error: "Missing orderId" });
    }

    const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({
        error: "Missing PayPal credentials"
      });
    }

    // LIVE URL
    const baseUrl = "https://api-m.paypal.com";

    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

    // 1) Get access token (LIVE)
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
        error: "Failed to get token (LIVE)",
        details: tokenText
      });
    }

    const { access_token } = JSON.parse(tokenText);

    // 2) Capture order (LIVE)
    const captureResponse = await fetch(
      `${baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json"
        }
      }
    );

    const captureText = await captureResponse.text();

    if (!captureResponse.ok) {
      return res.status(500).json({
        error: "Failed to capture order (LIVE)",
        details: captureText
      });
    }

    const captureData = JSON.parse(captureText);

    return res.status(200).json({
      message: "Payment captured successfully",
      details: captureData
    });

  } catch (err) {
    return res.status(500).json({
      error: "Server crash in capture-order",
      details: String(err)
    });
  }
}

