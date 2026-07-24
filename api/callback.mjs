/* ============================================================
   /api/callback — รับ code จาก GitHub แลกเป็น token
   แล้วส่งกลับให้หน้าต่าง Decap CMS ผ่าน postMessage
   ต้องตั้ง env: OAUTH_GITHUB_CLIENT_ID, OAUTH_GITHUB_CLIENT_SECRET
   ============================================================ */
export default async function handler(req, res) {
  const code = (req.query && req.query.code) || "";
  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
  const clientSecret = process.env.OAUTH_GITHUB_CLIENT_SECRET;

  let status = "error", content = { message: "ตั้งค่า OAuth ไม่ครบ" };

  if (code && clientId && clientSecret) {
    try {
      const r = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
      });
      const data = await r.json();
      if (data.access_token) {
        status = "success";
        content = { token: data.access_token, provider: "github" };
      } else {
        content = { message: data.error_description || "แลก token ไม่สำเร็จ" };
      }
    } catch (e) {
      content = { message: String(e.message || e) };
    }
  }

  const payload = "authorization:github:" + status + ":" + JSON.stringify(content);
  const html =
    "<!doctype html><html><head><meta charset='utf-8'></head><body><script>" +
    "(function(){function send(e){window.opener&&window.opener.postMessage(" +
    JSON.stringify(payload) + ", e && e.origin ? e.origin : '*');}" +
    "window.addEventListener('message', function(){ send(); }, false);" +
    "window.opener && window.opener.postMessage('authorizing:github','*');" +
    "})();</script><p>กำลังเข้าสู่ระบบ… ปิดหน้าต่างนี้ได้หากไม่กลับไปหน้าหลังบ้านอัตโนมัติ</p></body></html>";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
