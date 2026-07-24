/* ============================================================
   sheet.mjs — บันทึกคำสั่งซื้อลง Google Sheet
   ใช้ Google Apps Script Web App เป็นตัวรับ (ไม่ต้องใช้ service account)
   สคริปต์ที่ต้องวางใน Google Sheet อยู่ในไฟล์ google-apps-script.gs
   ============================================================ */

export async function appendToSheet(order) {
  const url = process.env.SHEET_WEBHOOK_URL;
  if (!url) return { skipped: true };

  const c = order.customer;
  const row = {
    secret:      process.env.SHEET_SECRET || "",
    orderNo:     order.orderNo,
    createdAt:   order.createdAt,
    status:      order.status,
    payment:     order.payment,
    firstName:   c.firstName,
    lastName:    c.lastName,
    phone:       c.phone,
    email:       c.email,
    address:     c.address,
    province:    c.province,
    zip:         c.zip,
    note:        c.note,
    items:       order.items.map((i) => `${i.name} x${i.qty}`).join(", "),
    subtotal:    order.subtotal,
    shipFee:     order.shipFee,
    grandTotal:  order.grandTotal,
    hasSlip:     order.hasSlip ? "มีสลิป" : "",
    paymentRef:  order.paymentRef || ""
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row)
  });
  if (!res.ok) throw new Error("Sheet error " + res.status);
  return { ok: true };
}

/* อัปเดตสถานะแถวเดิม (ใช้ตอน Pay Solutions แจ้งผลกลับมา) */
export async function updateSheetStatus(orderNo, status, paymentRef) {
  const url = process.env.SHEET_WEBHOOK_URL;
  if (!url) return { skipped: true };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: process.env.SHEET_SECRET || "",
      action: "updateStatus",
      orderNo, status, paymentRef: paymentRef || ""
    })
  });
  if (!res.ok) throw new Error("Sheet error " + res.status);
  return { ok: true };
}
