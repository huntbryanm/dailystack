/**
 * Vercel Serverless Function: Gumroad License Verification
 * 
 * Endpoint: POST /api/verify-license
 * Body: { "license_key": "XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" }
 * 
 * Returns: { "valid": true/false, "email": "...", "error": "..." }
 * 
 * Environment variables needed in Vercel dashboard:
 *   GUMROAD_PRODUCT_ID = your product permalink (e.g., "dailystack-pro")
 * 
 * Deploy: push this file to your repo under /api/verify-license.js
 * Vercel automatically turns files in /api into serverless functions.
 */

export default async function handler(req, res) {
  // CORS headers — allow your frontend domain
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { license_key } = req.body;

  if (!license_key) {
    return res.status(400).json({ valid: false, error: "License key is required" });
  }

  const productId = process.env.GUMROAD_PRODUCT_ID;

  if (!productId) {
    console.error("GUMROAD_PRODUCT_ID environment variable not set");
    return res.status(500).json({ valid: false, error: "Server configuration error" });
  }

  try {
    const response = await fetch("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        product_id: productId,
        license_key: license_key,
        increment_uses_count: "true",  // prevents reuse
      }),
    });

    const data = await response.json();

    if (data.success) {
      return res.status(200).json({
        valid: true,
        email: data.purchase?.email || null,
        uses: data.uses,
        created_at: data.purchase?.created_at || null,
      });
    } else {
      return res.status(200).json({
        valid: false,
        error: data.message || "Invalid license key",
      });
    }
  } catch (err) {
    console.error("Gumroad API error:", err);
    return res.status(500).json({
      valid: false,
      error: "Could not verify license. Please try again.",
    });
  }
}
