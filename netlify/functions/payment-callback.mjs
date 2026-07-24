/* ============================================================
   payment-callback — รับผลการชำระเงินจาก Pay Solutions (posturl)
   Pay Solutions จะยิงมาที่นี่หลังลูกค้าจ่ายเสร็จ (ฝั่งเซิร์ฟเวอร์ต่อเซิร์ฟเวอร์)
   ============================================================ */

import { sendToGroup } from "./lib/lark.mjs";
import { updateSheetStatus } from "./lib/sheet.mjs";
import { verifyCallback } from "./lib/gateway-payso.mjs";

export default async function handler(req) {
  /* Pay Solutions ส่งมาเป็น form POST — รองรับ JSON ด้วยเผื่อเปลี่ยนรูปแบบ */
  let params = {};
  try {
    const ctype = req.headers.get("content-type") || "";
    if (ctype.includes("application/json")) {
      params = await req.json();
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) params[k] = String(v);
    }
  } catch {
    /* บางเจ้าส่งมาเป็น query string */
    params = Object.fromEntries(new URL(req.url).searchParams.entries());
  }

  const result = verifyCallback(params);
  console.log("PAYMENT_CALLBACK", JSON.stringify({ ...result, raw: undefined }));

  if (!result.orderNo) {
    return new Response("missing refno", { status: 400 });
  }
  if (!result.valid) {
    /* checksum ไม่ตรง = อาจมีคนปลอมแปลง ไม่อัปเดตสถานะ แต่แจ้งเตือนไว้ */
    console.error("PAYMENT_CHECKSUM_MISMATCH", result.orderNo);
    try {
      await sendToGroup({
        msg_type: "text",
        content: { text: `⚠️ ได้รับผลการชำระเงินที่ตรวจสอบ checksum ไม่ผ่าน\nออเดอร์: ${result.orderNo}\nกรุณาตรวจสอบด้วยตนเองในระบบ Pay Solutions` }
      });
    } catch (e) { console.error("LARK_FAIL", String(e.message || e)); }
    return new Response("invalid checksum", { status: 400 });
  }

  const status = result.paid ? "paid" : "failed";

  try {
    await updateSheetStatus(result.orderNo, status, result.ref);
  } catch (e) {
    console.error("SHEET_FAIL", result.orderNo, String(e.message || e));
  }

  try {
    await sendToGroup({
      msg_type: "interactive",
      card: {
        config: { wide_screen_mode: true },
        header: {
          template: result.paid ? "green" : "red",
          title: {
            tag: "plain_text",
            content: result.paid
              ? `✅ ชำระเงินสำเร็จ · ${result.orderNo}`
              : `❌ ชำระเงินไม่สำเร็จ · ${result.orderNo}`
          }
        },
        elements: [{
          tag: "div",
          text: {
            tag: "lark_md",
            content: result.paid
              ? `ลูกค้าชำระผ่านบัตรเครดิตเรียบร้อยแล้ว\n**เลขอ้างอิงธุรกรรม:** ${result.ref || "-"}\n\n➡️ ดำเนินการแพ็กและจัดส่งได้เลย`
              : `การชำระเงินไม่สำเร็จ\n**เลขอ้างอิง:** ${result.ref || "-"}\n\n➡️ ติดต่อลูกค้าเพื่อเสนอวิธีชำระเงินอื่น`
          }
        }]
      }
    });
  } catch (e) {
    console.error("LARK_FAIL", String(e.message || e));
  }

  /* Pay Solutions ต้องการข้อความตอบกลับสั้น ๆ เพื่อยืนยันว่ารับข้อมูลแล้ว */
  return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
}

export const config = { path: "/.netlify/functions/payment-callback" };
