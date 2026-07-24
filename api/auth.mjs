/* ============================================================
   /api/auth — เริ่ม GitHub OAuth สำหรับล็อกอินหลังบ้าน Decap CMS
   (แทน Netlify Identity ที่ใช้ไม่ได้บน Vercel)
   ต้องตั้ง env: OAUTH_GITHUB_CLIENT_ID
   ============================================================ */
export default function handler(req, res) {
  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
  if (!clientId) return res.status(500).send("ยังไม่ได้ตั้งค่า OAUTH_GITHUB_CLIENT_ID");

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const redirectUri = "https://" + host + "/api/callback";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "repo,user",
    state: Math.random().toString(36).slice(2)
  });
  res.writeHead(302, { Location: "https://github.com/login/oauth/authorize?" + params.toString() });
  res.end();
}
