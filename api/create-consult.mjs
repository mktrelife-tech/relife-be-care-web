/* ============================================================
   /api/create-consult — รับคำขอนัดปรึกษา แล้วแจ้งเข้ากลุ่ม Lark (เป็น lead)
   ============================================================ */
import { sendToGroup } from "./lib/lark.mjs";

const clean = (v, max) => String(v == null ? "" : v).trim().slice(0, max || 200);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "ใช้ได้เฉพาะ POST" });
  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});

  const c = {
    topic: clean(body.topic, 120),
    name: clean(body.name, 60),
    phone: clean(body.phone, 20),
    time: clean(body.time, 60)
  };
  if (c.name.length < 2 || c.phone.replace(/\D/g, "").length < 9) {
    return res.status(400).json({ ok: false, error: "กรุณากรอกชื่อและเบอร์โทร" });
  }

  const ref = makeRef();
  try {
    await sendToGroup({
      msg_type: "interactive",
      card: {
        config: { wide_screen_mode: true },
        header: { template: "turquoise", title: { tag: "plain_text", content: "📅 นัดปรึกษาใหม่ · " + ref } },
        elements: [
          { tag: "div", fields: [
            { is_short: true, text: { tag: "lark_md", content: "**👤 ชื่อ**\n" + c.name } },
            { is_short: true, text: { tag: "lark_md", content: "**📞 เบอร์**\n" + c.phone } },
            { is_short: true, text: { tag: "lark_md", content: "**⏰ เวลาสะดวก**\n" + c.time } },
            { is_short: true, text: { tag: "lark_md", content: "**📌 เรื่อง**\n" + c.topic } }
          ] },
          { tag: "hr" },
          { tag: "action", actions: [
            { tag: "button", text: { tag: "plain_text", content: "📞 โทรกลับ" }, type: "primary", url: "tel:" + c.phone.replace(/\D/g, "") }
          ] }
        ]
      }
    });
    return res.status(200).json({ ok: true, ref });
  } catch (err) {
    console.error("CONSULT_LARK_FAIL", String(err.message || err));
    return res.status(502).json({ ok: false, error: "แจ้งทีมงานไม่สำเร็จ" });
  }
}

function makeRef() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return "CS-" + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + "-" + String(Math.floor(Math.random() * 900) + 100);
}
function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
