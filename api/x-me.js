// Vercel serverless: proxy X users/me (avoids browser CORS).

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing_bearer" });
  }

  try {
    const url = "https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username";
    const r = await fetch(url, { headers: { Authorization: auth } });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: "invalid_json", raw: text.slice(0, 200) }; }
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: "proxy_failed", message: String(e && e.message || e) });
  }
}
