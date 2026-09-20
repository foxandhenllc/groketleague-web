// Vercel serverless: proxy X OAuth2 token endpoint (avoids browser CORS).
// Public client — no client secret. Body must include client_id.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const params = new URLSearchParams();
    const grant = body.grant_type;
    if (grant === "authorization_code") {
      for (const k of ["grant_type", "code", "redirect_uri", "client_id", "code_verifier"]) {
        if (!body[k]) return res.status(400).json({ error: "missing_" + k });
        params.set(k, String(body[k]));
      }
    } else if (grant === "refresh_token") {
      for (const k of ["grant_type", "refresh_token", "client_id"]) {
        if (!body[k]) return res.status(400).json({ error: "missing_" + k });
        params.set(k, String(body[k]));
      }
    } else {
      return res.status(400).json({ error: "unsupported_grant" });
    }

    const r = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: "invalid_json", raw: text.slice(0, 200) }; }
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: "proxy_failed", message: String(e && e.message || e) });
  }
}
