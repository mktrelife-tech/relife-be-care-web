/* ============================================================
   /api/slip?o=<เลขออเดอร์>&k=<ลายเซ็น> — เปิดดูรูปสลิปจาก Vercel Blob (private)
   ลิงก์นี้อยู่ในการ์ด Lark และใน Google Sheet เท่านั้น
   ============================================================ */
import crypto from "node:crypto";
import { slipSig, readSlip } from "./lib/blob.mjs";

export default async function handler(req, res) {
  const orderNo = String(req.query.o || "");
  const k = String(req.query.k || "");
  if (!/^HW-\d{6}-\d{4}$/.test(orderNo) || k.length !== 24) return res.status(400).send("ลิงก์ไม่ถูกต้อง");

  const expect = slipSig(orderNo);
  if (!crypto.timingSafeEqual(Buffer.from(k), Buffer.from(expect))) return res.status(403).send("ไม่มีสิทธิ์ดูสลิปนี้");

  try {
    const s = await readSlip(orderNo);
    if (!s) return res.status(404).send("ไม่พบสลิปของออเดอร์นี้");
    res.setHeader("Content-Type", s.type);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-Robots-Tag", "noindex");
    return res.status(200).send(s.buf);
  } catch (err) {
    console.error("SLIP_READ_FAIL", orderNo, String(err.message || err));
    return res.status(404).send("ไม่พบสลิปของออเดอร์นี้");
  }
}
