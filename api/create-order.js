module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { amount, description } = req.body;

  return res.status(200).json({
    approvalUrl: "https://www.sandbox.paypal.com/checkoutnow?token=FAKE-TOKEN",
    message: "Order created (demo)"
  });
};
