// /api/capture-order.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: "Missing orderId" });
  }

  // PayPal credentials from Vercel Environment Variables
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  // Get Access Token
  const basicAuth = Buffer.from(clientId + ":" + clientSecret).toString("base64");

  const tokenResponse = await fetch(
    "https://api-m.sandbox.paypal.com/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    }
  );

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    return res
      .status(500)
      .json({ error: "Failed to get access token", details: error });
  }

  const { access_token } = await tokenResponse.json();

  // Capture the Order
  const captureResponse = await fetch(
    `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const captureData = await captureResponse.json();

  if (!captureResponse.ok) {
    return res
      .status(500)
      .json({ error: "Failed to capture order", details: captureData });
  }

  return res.status(200).json({
    message: "Order captured successfully",
    details: captureData,
  });
}
