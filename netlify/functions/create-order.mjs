/* ============================================================
   create-order — รับคำสั่งซื้อจากหน้าเว็บ
   1) ตรวจข้อมูล + คำนวณยอดใหม่จาก products.json (กันการแก้ราคาฝั่งลูกค้า)
   2) อัปโหลดสลิปเข้า Lark แล้วส่งการ์ดคำสั่งซื้อเข้ากลุ่ม
   3) บันทึกลง Google Sheet
   4) ถ้าจ่ายบัตร คืนค่าสำหรับ redirect ไปหน้าชำระเงิน Pay Solutions
   ============================================================ */

import { getTenantToken, uploadImage, sendToGroup, buildOrderCard } from "./lib/lark.mjs";
import { appendToSheet } from "./lib/sheet.mjs";
import { buildPayment } from "./lib/gateway-payso.mjs";

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

/* เลขออเดอร์: HW-YYMMDD-XXXX (สุ่ม 4 หลัก กันเดา) */
function makeOrderNo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const rnd = String(Math.floor(Math.random() * 9000) + 1000);
  return `HW-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${rnd}`;
}

const clean = (v, max) => String(v == null ? "" : v).trim().slice(0, max || 300);

export default async function handler(req, context) {
  if (req.method !== "POST") return json(405, { ok: false, error: "ใช้ได้เฉพาะ POST" });

  const siteUrl = (process.env.URL || process.env.DEPLOY_URL || "").replace(/\/$/, "");

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" });
  }

  /* ---------- ตรวจข้อมูลลูกค้า ---------- */
  const c = body.customer || {};
  const customer = {
    firstName: clean(c.firstName, 60),
    lastName:  clean(c.lastName, 60),
    phone:     clean(c.phone, 20),
    email:     clean(c.email, 120),
    address:   clean(c.address, 400),
    province:  clean(c.province, 60),
    zip:       clean(c.zip, 5),
    note:      clean(c.note, 400)
  };

  const missing = [];
  if (customer.firstName.length < 2) missing.push("ชื่อจริง");
  if (customer.lastName.length < 2) missing.push("นามสกุล");
  if (customer.phone.replace(/\D/g, "").length < 9) missing.push("เบอร์โทรศัพท์");
  if (customer.address.length < 10) missing.push("ที่อยู่จัดส่ง");
  if (customer.province.length < 2) missing.push("จังหวัด");
  if (!/^\d{5}$/.test(customer.zip)) missing.push("รหัสไปรษณีย์");
  if (missing.length) return json(400, { ok: false, error: "ข้อมูลไม่ครบ: " + missing.join(", ") });

  const payment = ["transfer", "cod", "card"].includes(body.payment) ? body.payment : "transfer";

  /* ---------- คำนวณราคาใหม่ฝั่งเซิร์ฟเวอร์ ---------- */
  if (!Array.isArray(body.items) || !body.items.length) {
    return json(400, { ok: false, error: "ไม่มีสินค้าในคำสั่งซื้อ" });
  }
  if (body.items.length > 50) {
    return json(400, { ok: false, error: "จำนวนรายการมากเกินไป" });
  }

  let catalog, site;
  try {
    const [pRes, sRes] = await Promise.all([
      fetch(`${siteUrl}/content/products.json`),
      fetch(`${siteUrl}/content/site.json`)
    ]);
    catalog = await pRes.json();
    site = await sRes.json();
  } catch {
    return json(500, { ok: false, error: "อ่านข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" });
  }

  const items = [];
  for (const raw of body.items) {
    const p = (catalog.products || []).find((x) => x.slug === raw.slug);
    if (!p) return json(400, { ok: false, error: `ไม่พบสินค้ารหัส ${clean(raw.slug, 40)}` });
    const qty = Math.min(Math.max(parseInt(raw.qty, 10) || 0, 1), 99);
    const pack = Math.max(parseInt(raw.pack, 10) || 1, 1);
    const pk = (p.packs || []).find((x) => Number(x.qty) === pack);
    const unit = pk ? pk.price : (p.price * pack);
    const label = pack > 1 ? `${p.name} (แพ็ก ${pack} กล่อง)` : p.name;
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
    payment,
    customer,
    items,
    subtotal,
    shipFee,
    grandTotal,
    hasSlip: !!(payment === "transfer" && body.slip),
    paymentRef: ""
  };

  /* ---------- แจ้งเข้า Lark ---------- */
  let larkOk = false, larkErr = "";
  try {
    let imageKey = null;
    if (order.hasSlip) {
      const token = await getTenantToken();
      if (token) imageKey = await uploadImage(token, body.slip);
    }
    await sendToGroup(buildOrderCard(order, imageKey));
    larkOk = true;
  } catch (err) {
    larkErr = String(err.message || err);
    console.error("LARK_FAIL", order.orderNo, larkErr);
  }

  /* ---------- บันทึกลง Google Sheet ---------- */
  let sheetOk = false;
  try {
    await appendToSheet(order);
    sheetOk = true;
  } catch (err) {
    console.error("SHEET_FAIL", order.orderNo, String(err.message || err));
  }

  /* ถ้าแจ้งเตือนล้มเหลวทั้งสองทาง ออเดอร์จะหายไปเลย — ต้องบอกลูกค้าตรง ๆ */
  if (!larkOk && !sheetOk) {
    return json(502, {
      ok: false,
      error: "ระบบรับคำสั่งซื้อขัดข้องชั่วคราว กรุณาสั่งซื้อทาง LINE หรือโทรหาเรา ขออภัยในความไม่สะดวก"
    });
  }

  /* ---------- บัตรเครดิต: ส่งค่าไปหน้าชำระเงิน ---------- */
  if (payment === "card") {
    try {
      const pay = buildPayment(order, siteUrl);
      /* โหมด api = POST อัตโนมัติ / โหมด link = แสดงคำแนะนำก่อนพาไป Pay.sn */
      return json(200, {
        ok: true,
        orderNo: order.orderNo,
        redirect: pay.mode === "api" ? pay : null,
        payLink: pay.mode === "link" ? pay : null
      });
    } catch (err) {
      return json(200, {
        ok: true,
        orderNo: order.orderNo,
        warning: "รับคำสั่งซื้อแล้ว แต่ระบบตัดบัตรยังไม่พร้อมใช้งาน ทีมงานจะติดต่อกลับเพื่อแจ้งวิธีชำระเงิน (" +
          String(err.message || err) + ")"
      });
    }
  }

  return json(200, { ok: true, orderNo: order.orderNo });
}

export const config = { path: "/.netlify/functions/create-order" };
