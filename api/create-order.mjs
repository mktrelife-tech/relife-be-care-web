/* ============================================================
   /api/create-order — Vercel Serverless Function
   รับคำสั่งซื้อ ตรวจข้อมูล คำนวณยอดใหม่ แจ้ง Lark บันทึก Sheet
   ============================================================ */

import { getTenantToken, uploadImage, sendToGroup, buildOrderCard } from "./lib/lark.mjs";
import { appendToSheet } from "./lib/sheet.mjs";
import { buildPayment } from "./lib/gateway-payso.mjs";

function siteUrlFrom(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return host ? "https://" + host : "";
}

const clean = (v, max) => String(v == null ? "" : v).trim().slice(0, max || 300);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "ใช้ได้เฉพาะ POST" });

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const siteUrl = siteUrlFrom(req);

  /* ---------- ตรวจข้อมูลลูกค้า ---------- */
  const c = body.customer || {};
  const customer = {
    firstName: clean(c.firstName, 60), lastName: clean(c.lastName, 60),
    phone: clean(c.phone, 20), email: clean(c.email, 120),
    address: clean(c.address, 400), province: clean(c.province, 60),
    zip: clean(c.zip, 5), note: clean(c.note, 400)
  };
  const missing = [];
  if (customer.firstName.length < 2) missing.push("ชื่อจริง");
  if (customer.lastName.length < 2) missing.push("นามสกุล");
  if (customer.phone.replace(/\D/g, "").length < 9) missing.push("เบอร์โทรศัพท์");
  if (customer.address.length < 10) missing.push("ที่อยู่จัดส่ง");
  if (customer.province.length < 2) missing.push("จังหวัด");
  if (!/^\d{5}$/.test(customer.zip)) missing.push("รหัสไปรษณีย์");
  if (missing.length) return res.status(400).json({ ok: false, error: "ข้อมูลไม่ครบ: " + missing.join(", ") });

  const payment = ["transfer", "cod", "card"].includes(body.payment) ? body.payment : "transfer";

  if (!Array.isArray(body.items) || !body.items.length)
    return res.status(400).json({ ok: false, error: "ไม่มีสินค้าในคำสั่งซื้อ" });
  if (body.items.length > 50)
    return res.status(400).json({ ok: false, error: "จำนวนรายการมากเกินไป" });

  /* ---------- คำนวณราคาใหม่ฝั่งเซิร์ฟเวอร์ ---------- */
  let catalog, site;
  try {
    const [pRes, sRes] = await Promise.all([
      fetch(siteUrl + "/content/products.json"),
      fetch(siteUrl + "/content/site.json")
    ]);
    catalog = await pRes.json();
    site = await sRes.json();
  } catch {
    return res.status(500).json({ ok: false, error: "อ่านข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" });
  }

  const items = [];
  for (const raw of body.items) {
    const p = (catalog.products || []).find((x) => x.slug === raw.slug);
    if (!p) return res.status(400).json({ ok: false, error: "ไม่พบสินค้ารหัส " + clean(raw.slug, 40) });
    const qty = Math.min(Math.max(parseInt(raw.qty, 10) || 0, 1), 99);
    const pack = Math.max(parseInt(raw.pack, 10) || 1, 1);
    /* ราคาอิงข้อมูลฝั่งเซิร์ฟเวอร์เสมอ — หาแพ็กจาก packs ถ้าไม่มีใช้ราคาเดี่ยว × จำนวนกล่อง */
    const pk = (p.packs || []).find((x) => Number(x.qty) === pack);
    const unit = pk ? pk.price : (p.price * pack);
    const label = pack > 1 ? (p.name + " (แพ็ก " + pack + " กล่อง)") : p.name;
    items.push({ slug: p.slug, name: label, pack, qty, price: unit, lineTotal: unit * qty });
  }

  const subtotal = items.reduce((a, i) => a + i.lineTotal, 0);
  const ship = site.shipping || {};
  const shipFee = (ship.fee === 0 || subtotal >= (ship.freeOver || 0)) ? 0 : (ship.fee || 0);
  const grandTotal = subtotal + shipFee;

  const order = {
    orderNo: makeOrderNo(),
    createdAt: new Date().toISOString(),
    status: payment === "card" ? "awaiting_payment" : "new",
    payment, customer, items, subtotal, shipFee, grandTotal,
    hasSlip: !!(payment === "transfer" && body.slip),
    paymentRef: ""
  };

  /* ---------- แจ้งเข้า Lark ---------- */
  let larkOk = false;
  try {
    let imageKey = null;
    if (order.hasSlip) {
      const token = await getTenantToken();
      if (token) imageKey = await uploadImage(token, body.slip);
    }
    await sendToGroup(buildOrderCard(order, imageKey));
    larkOk = true;
  } catch (err) {
    console.error("LARK_FAIL", order.orderNo, String(err.message || err));
  }

  /* ---------- บันทึกลง Google Sheet ---------- */
  let sheetOk = false;
  try {
    await appendToSheet(order);
    sheetOk = true;
  } catch (err) {
    console.error("SHEET_FAIL", order.orderNo, String(err.message || err));
  }

  if (!larkOk && !sheetOk) {
    return res.status(502).json({
      ok: false,
      error: "ระบบรับคำสั่งซื้อขัดข้องชั่วคราว กรุณาสั่งซื้อทาง LINE หรือโทรหาเรา ขออภัยในความไม่สะดวก"
    });
  }

  /* ---------- บัตรเครดิต ---------- */
  if (payment === "card") {
    try {
      const pay = buildPayment(order, siteUrl);
      return res.status(200).json({
        ok: true, orderNo: order.orderNo,
        redirect: pay.mode === "api" ? pay : null,
        payLink: pay.mode === "link" ? pay : null
      });
    } catch (err) {
      return res.status(200).json({
        ok: true, orderNo: order.orderNo,
        warning: "รับคำสั่งซื้อแล้ว แต่ระบบตัดบัตรยังไม่พร้อมใช้งาน ทีมงานจะติดต่อกลับ (" + String(err.message || err) + ")"
      });
    }
  }

  return res.status(200).json({ ok: true, orderNo: order.orderNo });
}

function makeOrderNo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const rnd = String(Math.floor(Math.random() * 9000) + 1000);
  return "HW-" + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + "-" + rnd;
}
function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
