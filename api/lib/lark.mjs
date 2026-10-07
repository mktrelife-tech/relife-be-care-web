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

  let pay = PAY_TEXT[order.payment] || order.payment;
  if (order.payment === "card" && order.status === "awaiting_payment") pay += "\n⏳ รอลูกค้าชำระ";

  const address = [c.address, c.subdistrict, c.district, c.province, c.zip].filter(Boolean).join(" ");

  const elements = [
    {
      tag: "div",
      fields: [
        field("👤 ลูกค้า", `${c.firstName} ${c.lastName}`),
        field("📞 เบอร์", c.phone),
        field("📦 แพ็กเกจ", pkg),
        field("💰 ยอดรวม", money(order.grandTotal)),
        field("💳 ชำระเงิน", pay),
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
  } else if (order.payment === "transfer") {
    elements.push({ tag: "div", text: { tag: "lark_md", content: "⚠️ **ลูกค้ายังไม่ได้แนบสลิป** — ต้องติดตามขอสลิป" } });
  }

  elements.push({
    tag: "note",
    elements: [{
      tag: "plain_text",
      content: `เลขออเดอร์ ${order.orderNo} · ค่าส่ง ${order.shipFee === 0 ? "ฟรี" : money(order.shipFee)}` +
        (c.email ? ` · ${c.email}` : "") + " · จากเว็บ hopefulrelife.com"
    }]
  });

  return {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: order.status === "paid" ? "green" : "orange",
        title: { tag: "plain_text", content: (order.status === "paid" ? "✅ ชำระเงินแล้ว " : "🛒 ออเดอร์ใหม่ ") + title }
      },
      elements
    }
  };
}
