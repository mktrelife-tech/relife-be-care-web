/* ============================================================
   /api/payment-callback — รับผลการชำระเงินจาก Pay Solutions
   ============================================================ */

import { sendToGroup } from "./lib/lark.mjs";
import { updateSheetStatus } from "./lib/sheet.mjs";
import { verifyCallback } from "./lib/gateway-payso.mjs";

export default async function handler(req, res) {
  let params = {};
  if (req.method === "GET") {
    params = req.query || {};
  } else if (typeof req.body === "string") {
    try { params = JSON.parse(req.body); }
    catch { params = Object.fromEntries(new URLSearchParams(req.body)); }
  } else {
    params = req.body || {};
  }

  const result = verifyCallback(params);
  console.log("PAYMENT_CALLBACK", JSON.stringify({ orderNo: result.orderNo, paid: result.paid, valid: result.valid }));

  if (!result.orderNo) return res.status(400).send("missing refno");

  if (!result.valid) {
    console.error("PAYMENT_CHECKSUM_MISMATCH", result.orderNo);
    try {
      await sendToGroup({
        msg_type: "text",
        content: { text: "⚠️ ผลการชำระเงิน checksum ไม่ผ่าน\nออเดอร์: " + result.orderNo + "\nกรุณาตรวจสอบในระบบ Pay Solutions" }
      });
    } catch (e) { console.error("LARK_FAIL", String(e.message || e)); }
    return res.status(400).send("invalid checksum");
  }

  const status = result.paid ? "paid" : "failed";
  try { await updateSheetStatus(result.orderNo, status, result.ref); }
  catch (e) { console.error("SHEET_FAIL", result.orderNo, String(e.message || e)); }

  try {
    await sendToGroup({
      msg_type: "interactive",
      card: {
        config: { wide_screen_mode: true },
        header: {
          template: result.paid ? "green" : "red",
          title: { tag: "plain_text", content: (result.paid ? "✅ ชำระเงินสำเร็จ · " : "❌ ชำระเงินไม่สำเร็จ · ") + result.orderNo }
        },
        elements: [{
          tag: "div",
          text: {
            tag: "lark_md",
            content: result.paid
              ? "ลูกค้าชำระผ่านบัตรเรียบร้อย\n**เลขอ้างอิง:** " + (result.ref || "-") + "\n\n➡️ ดำเนินการจัดส่งได้เลย"
              : "การชำระเงินไม่สำเร็จ\n**เลขอ้างอิง:** " + (result.ref || "-") + "\n\n➡️ ติดต่อลูกค้าเพื่อเสนอวิธีชำระเงินอื่น"
          }
        }]
      }
    });
  } catch (e) { console.error("LARK_FAIL", String(e.message || e)); }

  return res.status(200).send("OK");
}
