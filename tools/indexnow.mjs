/* ============================================================
   tools/indexnow.mjs — แจ้ง Bing (และเครื่องมือค้นหาที่ใช้ IndexNow) ว่าหน้าไหนเปลี่ยน
   ChatGPT ค้นเว็บผ่าน Bing → ยิ่ง Bing รู้เร็ว AI ยิ่งเห็นเนื้อหาใหม่เร็ว

   ใช้งาน:
     node tools/indexnow.mjs --diff <commitก่อน> <commitหลัง> [--wait]   (GitHub Actions เรียกแบบนี้)
     node tools/indexnow.mjs --all                                        (ส่งทุกหน้าใน sitemap)
     node tools/indexnow.mjs https://www.hopefulrelife.com/p/beta-oil.html ...

   --wait = รอจนหน้าเว็บจริงแสดงเนื้อหาใหม่ก่อน (Vercel deploy เสร็จ) แล้วค่อยแจ้ง
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "www.hopefulrelife.com";
const SITE = "https://" + HOST;
const KEY = "679e7c47573f663f85ae02b771b5943a";   /* ไฟล์ยืนยันอยู่ที่ /<KEY>.txt */

/* หน้าที่ไม่ต้องแจ้ง (หน้าระบบ / ไม่ให้ index) */
const SKIP = /^(checkout|thankyou|order|article|checklist|เช็คลิสต์|google[a-f0-9]+)\.html$|^admin\//;

function fileToUrl(f) {
  f = f.replace(/\\/g, "/");
  if (!f.endsWith(".html") || SKIP.test(f)) return null;
  if (!/^([^/]+|p\/[^/]+|blog\/[^/]+)\.html$/.test(f)) return null;
  return SITE + "/" + (f === "index.html" ? "" : f);
}

function sitemapUrls() {
  const xml = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => !/\.(jpe?g|png|webp)$/i.test(u));
}

const args = process.argv.slice(2);
const wait = args.includes("--wait");
let pairs = [];   /* [url, localFile|null] */

if (args[0] === "--all") {
  pairs = sitemapUrls().map((u) => [u, null]);
} else if (args[0] === "--diff") {
  const [, before, after] = args;
  let files;
  if (!before || /^0+$/.test(before)) {
    pairs = sitemapUrls().map((u) => [u, null]);   /* push แรก ไม่มีของเดิมให้เทียบ */
  } else {
    files = execSync(`git diff --name-only --diff-filter=AM ${before} ${after}`, { cwd: ROOT, encoding: "utf8" })
      .split("\n").map((s) => s.trim()).filter(Boolean);
    /* sitemap เปลี่ยน = มีหน้าใหม่/ลบหน้า → แจ้งทั้ง sitemap ด้วย */
    pairs = files.map((f) => [fileToUrl(f), f]).filter(([u]) => u);
    if (files.includes("sitemap.xml")) pairs.push(...sitemapUrls().map((u) => [u, null]));
  }
} else {
  pairs = args.filter((a) => a.startsWith("http")).map((u) => [u, null]);
}

/* ตัดซ้ำ */
const seen = new Set();
pairs = pairs.filter(([u]) => !seen.has(u) && seen.add(u));

if (!pairs.length) { console.log("IndexNow: ไม่มีหน้าที่เปลี่ยน — ไม่ต้องแจ้ง"); process.exit(0); }

/* รอให้ Vercel ขึ้นเนื้อหาใหม่ (เทียบไฟล์ในเครื่องกับหน้าเว็บจริง) สูงสุด 10 นาที */
if (wait) {
  const probe = pairs.find(([, f]) => f);
  if (probe) {
    const [url, file] = probe;
    const local = fs.readFileSync(path.join(ROOT, file), "utf8");
    const deadline = Date.now() + 10 * 60 * 1000;
    process.stdout.write(`IndexNow: รอให้ ${url} ขึ้นเวอร์ชันใหม่ `);
    for (;;) {
      try {
        const live = await (await fetch(url + "?indexnow=" + Date.now(), { cache: "no-store" })).text();
        if (live === local) { console.log("✓ ขึ้นแล้ว"); break; }
      } catch {}
      if (Date.now() > deadline) { console.log("— หมดเวลารอ แจ้งเลย"); break; }
      process.stdout.write(".");
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
}

const urlList = pairs.map(([u]) => u);
if (args.includes("--dry")) { console.log("IndexNow (ทดลอง ไม่ส่งจริง):"); urlList.forEach((u) => console.log("  •", u)); process.exit(0); }
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList })
});
const body = await res.text();
console.log(`IndexNow: แจ้ง ${urlList.length} หน้า → HTTP ${res.status} ${body.slice(0, 200)}`);
urlList.forEach((u) => console.log("  •", u));
/* 200 = รับแล้ว, 202 = รับแล้ว (กำลังยืนยัน key) */
if (res.status !== 200 && res.status !== 202) process.exit(1);
