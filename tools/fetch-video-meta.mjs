// ดึงข้อมูลคลิป YouTube (ชื่อ คำอธิบาย วันอัปโหลด ความยาว) ของ explainerVideos + trustVideo → content/videos.json
// ใช้ทำ VideoObject schema + ส่วนวิดีโอแบบ static ในหน้าสินค้า (prerender อ่านไฟล์นี้ ไม่ต่อเน็ตตอน build)
//   node tools/fetch-video-meta.mjs          (ดึงเฉพาะคลิปที่ยังไม่มีในไฟล์)
//   node tools/fetch-video-meta.mjs --all    (ดึงใหม่ทั้งหมด)
import fs from "node:fs";
const P = JSON.parse(fs.readFileSync("content/products.json", "utf8"));
const products = P.products || P;
const FILE = "content/videos.json";
const db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {};
const all = process.argv.includes("--all");
const SITE = JSON.parse(fs.readFileSync("content/site.json", "utf8"));
/* เฉพาะคลิปให้ความรู้ (explainerVideos + trustVideo) — คลิปรีวิวที่พูดถึงโรค ไม่เอามาเป็นข้อความ/สคีมาบนเว็บ */
const ids = [...new Set([SITE.trustVideo, ...products.flatMap((p) => p.explainerVideos || [])].filter(Boolean))];

const pick = (h, re) => (h.match(re) || [])[1];
const unesc = (s) => s && JSON.parse(`"${s}"`);
for (const id of ids) {
  if (db[id] && !all) continue;
  const h = await fetch(`https://www.youtube.com/watch?v=${id}`, { headers: { "Accept-Language": "th" } }).then((r) => r.text());
  const meta = {
    id,
    title: unesc(pick(h, /"videoDetails":\{"videoId":"[^"]+","title":"((?:[^"\\]|\\.)*)"/)),
    description: unesc(pick(h, /"shortDescription":"((?:[^"\\]|\\.)*)"/)) || "",
    uploadDate: pick(h, /"uploadDate":"([^"]+)"/),
    seconds: Number(pick(h, /"lengthSeconds":"(\d+)"/) || 0)
  };
  if (!meta.title || !meta.uploadDate) { console.log("skip (no data):", id); continue; }
  meta.name = meta.title.replace(/#\S+/g, "").trim(); /* แก้ชื่อที่แสดงบนเว็บได้ใน videos.json (field name) */
  db[id] = meta;
  console.log("ok", id, meta.seconds + "s", meta.title.slice(0, 70));
}
fs.writeFileSync(FILE, JSON.stringify(db, null, 2) + "\n");
console.log("videos:", Object.keys(db).length);
