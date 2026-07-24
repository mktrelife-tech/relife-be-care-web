/* ============================================================
   gateway-payso.mjs — ตัวเชื่อมกับ Pay Solutions

   รองรับ 2 โหมด สลับด้วย env: PAYSO_MODE = "link" (ค่าเริ่มต้น) หรือ "api"

   ── โหมด "link" ── ใช้ได้ทันที ไม่ต้องขออะไรเพิ่ม
      ใช้ Payment Link ที่มีอยู่แล้ว รูปแบบ:
        https://pay.sn/relifesolutions/<ยอดเงิน>/<รายละเอียดสินค้า>

      ทดสอบกับหน้าจริงแล้ว (23 ก.ค. 2026):
        • ส่งค่าแบบ query string (?total=...) ใช้ไม่ได้ ช่องยังว่าง
        • ส่งแบบ path ใช้ได้ → total และ productdetail ถูกเติมอัตโนมัติ
        • ทั้งสองช่องเป็น readonly ลูกค้าแก้ยอดเองไม่ได้ ✓
        • เลี่ยงการเว้นวรรคในรายละเอียดสินค้า เพราะช่องที่ส่งจริงจะเก็บเป็น %20

      ⚠️ ข้อจำกัดที่ยังเหลือ: Pay Solutions ไม่ยิงผลกลับมาที่เว็บเรา
         ระบบจึงไม่รู้อัตโนมัติว่าลูกค้าจ่ายสำเร็จหรือยัง
         ต้องเช็คในพอร์ทัล Pay Solutions หรืออีเมลแจ้งเตือนจากเขา
         แก้ได้ด้วยการเปลี่ยนไปใช้โหมด "api" ด้านล่าง

   ── โหมด "api" ── สมบูรณ์กว่ามาก
      ส่งยอดเงินและเลขออเดอร์ไปให้เลย ลูกค้าไม่ต้องพิมพ์ และ Pay Solutions
      จะยิงผลกลับมาที่ payment-callback ทำให้ระบบรู้เองว่าจ่ายสำเร็จหรือไม่
      ต้องติดต่อ Pay Solutions ขอ "เอกสารเชื่อมต่อ (Integration Guide)" สำหรับ
      Merchant ID ของคุณ แล้วกรอก env ตาม .env.example
      ถ้าชื่อฟิลด์ในเอกสารไม่ตรงกับด้านล่าง แก้ที่ buildApiRedirect() จุดเดียว
   ============================================================ */

import crypto from "node:crypto";

const MODE = (process.env.PAYSO_MODE || "link").toLowerCase();

/* ---------- โหมด link ---------- */
const PAY_LINK = process.env.PAYSO_PAY_LINK || "https://pay.sn/relifesolutions";

/* ---------- โหมด api ---------- */
const API_ENDPOINT = process.env.PAYSO_ENDPOINT || "https://www.thaiepay.com/epaylink/payment.aspx";

function makeChecksum(parts) {
  const secret = process.env.PAYSO_SECRET_KEY || "";
  const algo = (process.env.PAYSO_HASH_ALGO || "md5").toLowerCase();
  return crypto.createHash(algo).update(parts.join("") + secret, "utf8").digest("hex");
}

function buildApiRedirect(order, siteUrl) {
  const merchantId = process.env.PAYSO_MERCHANT_ID;
  if (!merchantId) throw new Error("ยังไม่ได้ตั้งค่า PAYSO_MERCHANT_ID");

  const c = order.customer;
  const total = order.grandTotal.toFixed(2);

  const fields = {
    merchantid:        merchantId,
    refno:             order.orderNo,
    customeremail:     c.email || "",
    productdetail:     order.items.map((i) => `${i.name} x${i.qty}`).join(", ").slice(0, 250),
    total,
    cc:                "00",   /* 00 = บาท */
    lang:              "TH",
    returnurl:         `${siteUrl}/thankyou.html?no=${encodeURIComponent(order.orderNo)}&pay=card`,
    posturl:           `${siteUrl}/.netlify/functions/payment-callback`,
    customername:      `${c.firstName} ${c.lastName}`.slice(0, 100),
    customeraddress:   `${c.address} ${c.province} ${c.zip}`.slice(0, 200),
    customertelephone: String(c.phone).replace(/\D/g, "")
  };

  if (process.env.PAYSO_SECRET_KEY) {
    fields.checksum = makeChecksum([merchantId, order.orderNo, total]);
  }
  return { mode: "api", url: API_ENDPOINT, method: "POST", fields };
}

/* ---------- ตัวเรียกใช้หลัก ---------- */
export function buildPayment(order, siteUrl) {
  if (MODE === "api") return buildApiRedirect(order, siteUrl);

  /* โหมด link — ประกอบ URL แบบ path: /<ยอดเงิน>/<รายละเอียด>
     รายละเอียดต้องไม่มีช่องว่าง ไม่งั้นจะกลายเป็น %20 ในระบบ Pay Solutions */
  const detail = (
    order.orderNo + "_" +
    order.items.map((i) => i.name.replace(/\s+/g, "") + "x" + i.qty).join("-")
  ).replace(/[^\w\-.]/g, "").slice(0, 100);

  const base = PAY_LINK.replace(/\/+$/, "");
  return {
    mode: "link",
    url: `${base}/${order.grandTotal}/${encodeURIComponent(detail)}`,
    amount: order.grandTotal,
    reference: order.orderNo,
    detail
  };
}

/* ---------- ตรวจสอบผลที่ Pay Solutions ส่งกลับ (ใช้เฉพาะโหมด api) ---------- */
export function verifyCallback(params) {
  const orderNo = params.refno || params.referenceNo || params.orderNo || "";
  const status  = String(params.status || params.result || params.respCode || "").toUpperCase();
  const ref     = params.transactionid || params.tranid || params.paymentRef || "";

  const OK_CODES = (process.env.PAYSO_SUCCESS_CODES || "CO,00,000,SUCCESS,PAID")
    .split(",").map((x) => x.trim().toUpperCase());

  let valid = true;
  if (process.env.PAYSO_SECRET_KEY && params.checksum) {
    const expect = makeChecksum([process.env.PAYSO_MERCHANT_ID, orderNo, params.total || ""]);
    valid = String(params.checksum).toLowerCase() === expect.toLowerCase();
  }

  return { valid, orderNo, paid: OK_CODES.includes(status), ref };
}

export const paysoMode = MODE;
