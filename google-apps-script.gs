/**
 * ============================================================
 *  บันทึกออเดอร์ลง Google Sheet
 * ============================================================
 *
 *  วิธีติดตั้ง (ทำครั้งเดียว ~5 นาที)
 *  ------------------------------------------------------------
 *  1. สร้าง Google Sheet ใหม่ ตั้งชื่ออะไรก็ได้ เช่น "ออเดอร์เว็บไซต์"
 *  2. เมนู  ส่วนขยาย (Extensions) → Apps Script
 *  3. ลบโค้ดเดิมทิ้งทั้งหมด แล้ววางโค้ดในไฟล์นี้ลงไป
 *  4. แก้ SECRET ด้านล่างเป็นรหัสลับของคุณเอง (ตั้งเองอะไรก็ได้ ยาว ๆ)
 *  5. กด บันทึก (💾) แล้วกด ทำให้ใช้งานได้ (Deploy) → การทำให้ใช้งานได้ใหม่ (New deployment)
 *  6. เลือกประเภท: เว็บแอป (Web app)
 *       - ดำเนินการในฐานะ (Execute as)  : ฉัน (Me)
 *       - ผู้ที่มีสิทธิ์เข้าถึง (Who has access) : ทุกคน (Anyone)
 *  7. กด Deploy → อนุญาตสิทธิ์ → คัดลอก "URL ของเว็บแอป"
 *  8. เอา URL ไปใส่ที่ Netlify เป็น SHEET_WEBHOOK_URL
 *     และเอา SECRET ไปใส่เป็น SHEET_SECRET
 *
 *  ⚠️ ถ้าแก้โค้ดนี้ทีหลัง ต้อง Deploy ใหม่ทุกครั้ง (เลือก "จัดการการทำให้ใช้งานได้"
 *     → แก้ไข → เวอร์ชันใหม่) ไม่งั้นการแก้จะไม่มีผล
 */

/* 👉 เปลี่ยนเป็นรหัสลับของคุณเอง แล้วใช้ค่าเดียวกันนี้ที่ Netlify */
var SECRET = 'เปลี่ยนรหัสนี้เป็นของคุณเอง-ยาวๆ-เดายาก';

var HEADERS = [
  'เวลาที่สั่ง', 'เลขออเดอร์', 'สถานะ', 'วิธีชำระเงิน',
  'ชื่อ', 'นามสกุล', 'เบอร์โทร', 'อีเมล',
  'ที่อยู่', 'จังหวัด', 'รหัสไปรษณีย์', 'หมายเหตุ',
  'รายการสินค้า', 'ค่าสินค้า', 'ค่าส่ง', 'ยอดรวม',
  'สลิป', 'เลขอ้างอิงการชำระเงิน'
];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (body.secret !== SECRET) {
      return out({ ok: false, error: 'unauthorized' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    /* ใส่หัวตารางถ้ายังไม่มี */
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length)
        .setFontWeight('bold')
        .setBackground('#F7EFE5');
      sheet.setFrozenRows(1);
    }

    /* ---- อัปเดตสถานะของออเดอร์เดิม ---- */
    if (body.action === 'updateStatus') {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][1]) === String(body.orderNo)) {
          sheet.getRange(i + 1, 3).setValue(body.status);
          if (body.paymentRef) sheet.getRange(i + 1, 18).setValue(body.paymentRef);
          return out({ ok: true, updated: body.orderNo });
        }
      }
      return out({ ok: false, error: 'ไม่พบเลขออเดอร์ ' + body.orderNo });
    }

    /* ---- เพิ่มออเดอร์ใหม่ ---- */
    sheet.appendRow([
      body.createdAt || new Date(),
      body.orderNo || '',
      body.status || '',
      body.payment || '',
      body.firstName || '',
      body.lastName || '',
      "'" + (body.phone || ''),   /* ใส่ ' นำหน้า กัน Sheet ตัดเลข 0 ตัวแรกทิ้ง */
      body.email || '',
      body.address || '',
      body.province || '',
      "'" + (body.zip || ''),
      body.note || '',
      body.items || '',
      Number(body.subtotal) || 0,
      Number(body.shipFee) || 0,
      Number(body.grandTotal) || 0,
      body.hasSlip || '',
      body.paymentRef || ''
    ]);

    return out({ ok: true, orderNo: body.orderNo });

  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

/* เปิด URL ตรง ๆ เพื่อเช็คว่า deploy สำเร็จหรือยัง */
function doGet() {
  return out({ ok: true, message: 'ระบบบันทึกออเดอร์พร้อมใช้งาน' });
}

function out(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
