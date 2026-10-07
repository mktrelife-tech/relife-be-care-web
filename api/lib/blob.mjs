/* ============================================================
   blob.mjs — เก็บรูปสลิปไว้ใน Vercel Blob (แบบ private)
   ต้องมี env BLOB_READ_WRITE_TOKEN (Vercel ใส่ให้เองเมื่อเชื่อม Blob store กับโปรเจกต์)
   สลิปมีชื่อ/เลขบัญชีลูกค้า จึงเก็บแบบ private และเปิดดูผ่าน /api/slip ที่มีลายเซ็นเท่านั้น
   ============================================================ */
import crypto from "node:crypto";
import { put, get } from "@vercel/blob";

const enabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const pathFor = (orderNo) => `slips/${orderNo}.jpg`;

/* ลายเซ็นของลิงก์ดูสลิป — กันคนเดาเลขออเดอร์แล้วเปิดสลิปคนอื่น */
export function slipSig(orderNo) {
  return crypto.createHmac("sha256", process.env.BLOB_READ_WRITE_TOKEN || "")
    .update(String(orderNo)).digest("hex").slice(0, 24);
}

/* อัปโหลดสลิป (data URL) คืนลิงก์สำหรับเปิดดู หรือ null ถ้ายังไม่ได้ตั้งค่า Blob */
export async function uploadSlip(orderNo, dataUrl, siteUrl) {
  if (!enabled()) return null;
  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUrl || "");
  if (!m) throw new Error("รูปแบบไฟล์สลิปไม่ถูกต้อง");
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > 10 * 1024 * 1024) throw new Error("ไฟล์สลิปใหญ่เกินไป");

  await put(pathFor(orderNo), bytes, {
    access: "private",
    contentType: m[1],
    addRandomSuffix: false,
    allowOverwrite: true
  });
  return `${siteUrl}/api/slip?o=${encodeURIComponent(orderNo)}&k=${slipSig(orderNo)}`;
}

/* อ่านสลิปกลับมา (ใช้ใน /api/slip) */
export async function readSlip(orderNo) {
  const r = await get(pathFor(orderNo), { access: "private" });
  if (!r || !r.stream) return null;
  const buf = Buffer.from(await new Response(r.stream).arrayBuffer());
  return { buf, type: (r.blob && r.blob.contentType) || "image/jpeg" };
}
