/* ============================================================
   lark.mjs — ส่งแจ้งเตือนคำสั่งซื้อเข้ากลุ่ม Lark
   ไม่ใช้ไลบรารีภายนอกเลย ใช้ fetch ที่มากับ Node 18+
   ============================================================ */

/* Lark (สากล) ใช้ open.larksuite.com — Feishu (จีน) ใช้ open.feishu.cn */
const BASE = process.env.LARK_BASE_URL || "https://open.larksuite.com";

/* ---------- ขอ token สำหรับเรียก API (ใช้ตอนอัปโหลดรูปสลิป) ---------- */
export async function getTenantToken() {
  const id = process.env.LARK_APP_ID, secret = process.env.LARK_APP_SECRET;
  if (!id || !secret) return null;

  const res = await fetch(BASE + "/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: id, app_secret: secret })
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error("Lark token error: " + (data.msg || data.code));
  return data.tenant_access_token;
}

/* ---------- อัปโหลดรูปสลิปเข้า Lark คืนค่า image_key ---------- */
export async function uploadImage(token, dataUrl) {
  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUrl || "");
  if (!m) throw new Error("รูปแบบไฟล์สลิปไม่ถูกต้อง");

  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > 10 * 1024 * 1024) throw new Error("ไฟล์สลิปใหญ่เกินไป");

  const fd = new FormData();
  fd.append("image_type", "message");
  fd.append("image", new Blob([bytes], { type: m[1] }), "slip.jpg");

  const res = await fetch(BASE + "/open-apis/im/v1/images", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: fd
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error("Lark upload error: " + (data.msg || data.code));
  return data.data.image_key;
}

/* ---------- ส่งข้อความเข้ากลุ่มผ่าน Custom Bot Webhook ---------- */
export async function sendToGroup(payload) {
  const url = process.env.LARK_WEBHOOK_URL;
  if (!url) throw new Error("ยังไม่ได้ตั้งค่า LARK_WEBHOOK_URL");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  /* webhook ตอบ code 0 หรือ StatusCode 0 แล้วแต่รุ่น */
  if (data.code && data.code !== 0) throw new Error("Lark webhook error: " + (data.msg || data.code));
  return true;
}

/* ---------- ประกอบการ์ดคำสั่งซื้อ ---------- */
const PAY_LABEL = {
  transfer: "🏦 โอนเงิน",
  cod:      "💵 เก็บเงินปลายทาง",
  card:     "💳 บัตรเครดิต"
};
const STATUS_LABEL = {
  new:              "🆕 คำสั่งซื้อใหม่",
  awaiting_payment: "⏳ รอชำระเงิน (บัตร)",
  paid:             "✅ ชำระเงินสำเร็จ",
  failed:           "❌ ชำระเงินไม่สำเร็จ"
};

/* วิธีชำระเงินแบบที่ทีมอ่านง่าย (ตามการ์ดของเว็บ LAB FARM) */
const PAY_TEXT = {
  transfer: "โอนเงิน",
  cod:      "เก็บปลายทาง (COD)",
  card:     "บัตรเครดิต (Pay Solutions)"
};

export function buildOrderCard(order, imageKey) {
  const c = order.customer;
  const money = (n) => "฿" + Number(n).toLocaleString("th-TH");
  const field = (label, value) => ({ is_short: true, text: { tag: "lark_md", content: `**${label}**\n${value}` } });

  /* หัวการ์ด: ถ้าสั่งสินค้าตัวเดียวใช้ชื่อสินค้า ไม่งั้นใช้ชื่อร้าน */
  const names = [...new Set(order.items.map((i) => i.product || i.name))];
  const title = names.length === 1 ? names[0] : "Hopeful Relife";

  const pkg = order.items
    .map((i) => `${i.name}${i.qty > 1 ? " × " + i.qty : ""}`)
    .join("\n");

  /* สถานะการจ่าย → บอกทีมว่าทำอะไรต่อ (ส่งได้เลย / ต้องเช็คก่อน) */
  let action;
  if (order.status === "paid")             action = "✅ **ชำระแล้ว → ส่งของได้เลย**";
  else if (order.payment === "cod")        action = "💵 **เก็บปลายทาง (COD) → ส่งของได้เลย**";
  else if (order.payment === "card")       action = "⏳ **บัตรเครดิต รอลูกค้าชำระ → ยังไม่ส่ง** เช็คใน Pay Solutions ก่อน";
  else if (order.hasSlip)                  action = "🏦 **โอนเงิน แนบสลิปแล้ว → ตรวจยอดเงินเข้าก่อนส่ง**";
  else                                     action = "⚠️ **โอนเงิน ยังไม่แนบสลิป → ทักขอสลิปก่อนส่ง**";

  const address = [c.address, c.subdistrict, c.district, c.province, c.zip].filter(Boolean).join(" ");

  const elements = [
    { tag: "div", text: { tag: "lark_md", content: `🔖 **เลขออเดอร์  ${order.orderNo}**\n${action}` } },
    { tag: "hr" },
    {
      tag: "div",
      fields: [
        field("👤 ลูกค้า", `${c.firstName} ${c.lastName}`),
        field("📞 เบอร์", c.phone),
        field("📦 แพ็กเกจ", pkg),
        field("💰 ยอดรวม", money(order.grandTotal)),
        field("💳 ชำระเงิน", PAY_TEXT[order.payment] || order.payment),
        field("🗺️ จังหวัด", c.province)
      ]
    },
    { tag: "div", text: { tag: "lark_md", content: `**📍 ที่อยู่จัดส่ง**\n${address}` } }
  ];

  if (c.note) {
    elements.push({ tag: "div", text: { tag: "lark_md", content: `**📝 หมายเหตุ**\n${c.note}` } });
  }

  if (imageKey) {
    elements.push({ tag: "div", text: { tag: "lark_md", content: "**🧾 สลิปโอนเงิน**" } });
    elements.push({ tag: "img", img_key: imageKey, alt: { tag: "plain_text", content: "สลิปโอนเงิน" } });
  }

  elements.push({
    tag: "note",
    elements: [{
      tag: "plain_text",
      content: `ค่าส่ง ${order.shipFee === 0 ? "ฟรี" : money(order.shipFee)}` +
        (c.email ? ` · ${c.email}` : "") + " · ที่มา: เว็บ hopefulrelife.com"
    }]
  });

  /* หัวการ์ดสีฟ้าเทอร์ควอยซ์ + ป้าย "ออเดอร์เว็บ" ให้แยกจากการ์ดเว็บอื่น (LAB FARM ใช้สีส้ม) */
  return {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: order.status === "paid" ? "green" : "turquoise",
        title: { tag: "plain_text", content: (order.status === "paid" ? "✅ ชำระแล้ว · " : "🌐 ออเดอร์เว็บ Hopeful Relife · ") + title }
      },
      elements
    }
  };
}
