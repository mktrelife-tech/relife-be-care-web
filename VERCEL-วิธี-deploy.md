# วิธี Deploy ขึ้น Vercel — RELIFE BE CARE

โปรเจกต์นี้ถูกแปลงเป็นรูปแบบ Vercel เรียบร้อยแล้ว เหลือแค่ทำตามขั้นตอนด้านล่าง
(ผมทำแทนไม่ได้ เพราะต้องใช้บัญชี GitHub และ Vercel ของคุณเอง — แต่ทุกอย่างเตรียมไว้ให้หมดแล้ว)

---

## ขั้นที่ 1 — ขึ้น GitHub (ครั้งเดียว)

1. สมัคร/เข้า github.com → กด **New repository**
   - ชื่อ: `relife-be-care-web` (หรือชื่ออื่น) → ตั้ง **Private** ได้ → **Create**
2. หน้าถัดไปจะมีคำสั่ง ให้ก๊อป **URL ของ repo** มา (เช่น `https://github.com/ชื่อคุณ/relife-be-care-web.git`)
3. บอก URL นั้นกับผม เดี๋ยวผมรันคำสั่ง push ให้ — หรือรันเองในเครื่อง:
   ```bash
   cd "C:/ALL AI/wellness-web"
   git remote add origin <URL ที่ก๊อปมา>
   git push -u origin main
   ```

---

## ขั้นที่ 2 — เชื่อม Vercel

1. เข้า vercel.com → **Add New… → Project** → เลือก **Continue with GitHub**
2. เลือก repo `relife-be-care-web` → **Import**
3. หน้า Configure Project — **ไม่ต้องตั้งอะไร** (ไม่มี build step) → กด **Deploy**
4. รอสักครู่ จะได้ลิงก์เว็บ เช่น `https://relife-be-care-web.vercel.app` — เปิดดูได้เลย ✅

> แค่ 2 ขั้นนี้เว็บก็ออนไลน์แล้ว (หน้าเว็บ + ตะกร้า + หน้าสั่งซื้อทำงาน)
> ส่วนขั้น 3–4 ด้านล่างคือ "เปิดระบบเบื้องหลัง" (แจ้ง Lark / บันทึก Sheet / หลังบ้าน)

---

## ขั้นที่ 3 — ใส่ค่า Environment Variables

Vercel → เลือกโปรเจกต์ → **Settings → Environment Variables** → เพิ่มทีละตัวตามไฟล์ [.env.example](.env.example)

| ตัวแปร | เอามาจากไหน | จำเป็น |
|---|---|---|
| `SITE_URL` | โดเมนจริง เช่น `https://relife-be-care-web.vercel.app` | แนะนำ |
| `LARK_WEBHOOK_URL` | กลุ่ม Lark → Settings → Bots → Custom Bot | ✅ |
| `LARK_APP_ID` / `LARK_APP_SECRET` | open.larksuite.com (เปิดสิทธิ์ `im:resource`) | สำหรับส่งรูปสลิป |
| `SHEET_WEBHOOK_URL` / `SHEET_SECRET` | ทำตามไฟล์ `google-apps-script.gs` | เก็บลง Sheet |
| `PAYSO_MODE` | ใส่ `link` (ใช้ Payment Link ที่มีอยู่) | ✅ |
| `PAYSO_PAY_LINK` | `https://pay.sn/relifesolutions` | ✅ |
| `OAUTH_GITHUB_CLIENT_ID` / `_SECRET` | สำหรับล็อกอินหลังบ้าน (ขั้น 4) | ถ้าจะใช้ /admin |

> ใส่/แก้ env แล้วต้องกด **Redeploy** หนึ่งครั้ง (Deployments → ••• → Redeploy) ค่าใหม่ถึงจะมีผล

---

## ขั้นที่ 4 — เปิดหลังบ้าน /admin (ถ้าต้องการแก้เนื้อหาเองผ่านหน้าจอ)

บน Vercel ใช้ล็อกอินผ่าน GitHub (แทน Netlify Identity):

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
   - Application name: `RELIFE CMS`
   - Homepage URL: `https://<โดเมนคุณ>.vercel.app`
   - Authorization callback URL: `https://<โดเมนคุณ>.vercel.app/api/callback`
   - **Register** → ก๊อป **Client ID** และกด Generate a new **Client secret**
2. เอาสองค่านั้นใส่เป็น env `OAUTH_GITHUB_CLIENT_ID` / `OAUTH_GITHUB_CLIENT_SECRET` → Redeploy
3. แก้ไฟล์ `admin/config.yml` 2 บรรทัด (แล้ว push):
   ```yaml
   repo: ชื่อบัญชีคุณ/relife-be-care-web
   base_url: https://<โดเมนคุณ>.vercel.app
   ```
4. เข้า `https://<โดเมนคุณ>.vercel.app/admin` → **Login with GitHub** → แก้เนื้อหาได้เลย

---

## ขั้นที่ 5 — ผูกโดเมนจริง (เมื่อพร้อม)

Vercel → **Settings → Domains → Add** → ใส่โดเมน (เช่น `relifebecare.com`)
→ ทำตามที่ Vercel บอก (แก้ DNS ที่ผู้ให้บริการโดเมน) → เสร็จแล้วอัปเดต `SITE_URL` และ `base_url` เป็นโดเมนใหม่

---

## หลัง deploy เสร็จ — ทดสอบ 1 ออเดอร์

สั่งซื้อจริง 1 รายการทั้งแบบ **โอน (แนบสลิป)** และ **ปลายทาง** แล้วเช็คว่า:
- การ์ดออเดอร์เด้งเข้ากลุ่ม Lark (พร้อมรูปสลิป)
- มีแถวใหม่ใน Google Sheet

ถ้าไม่เข้า → Vercel → **Deployments → Functions → create-order → Logs** จะเห็น `LARK_FAIL` / `SHEET_FAIL` บอกสาเหตุ

---

## หมายเหตุ

- โฟลเดอร์ `netlify/` เดิมยังอยู่ (ไม่ได้ลบ) — Vercel ไม่สนใจ ปล่อยไว้ได้ ถ้าไม่อยากรกลบทิ้งได้
- ระบบบัตรเครดิตตอนนี้เป็นโหมด `link` (พาไปหน้า Pay.sn พร้อมยอด+เลขออเดอร์อัตโนมัติ)
  ถ้าอยากให้ระบบ **รู้ผลการชำระเงินเอง** ต้องขอเอกสารเชื่อมต่อจาก Pay Solutions แล้วเปลี่ยนเป็นโหมด `api`
- ไฟล์ที่แนบสลิปถูกย่อในเบราว์เซอร์ก่อนส่ง จึงเล็กกว่าลิมิต Vercel (4.5 MB) เสมอ
