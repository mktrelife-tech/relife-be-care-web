// ย่อปกจาก .covers-work/full/<slug>.png → assets/img/articles/cover-<slug>.jpg (1280x720) แล้วต่อด้วยสคริปต์บทความ + prerender
//   node tools/covers/finish-full.mjs [slug ...]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const specs = JSON.parse(fs.readFileSync("tools/covers/covers-full.json", "utf8"));
const only = process.argv.slice(2);
let n = 0;
for (const s of specs) {
  if (only.length && !only.includes(s.slug)) continue;
  const src = `.covers-work/full/${s.slug}.png`;
  if (!fs.existsSync(src)) { console.log("missing", s.slug); continue; }
  const dst = `assets/img/articles/cover-${s.slug}.jpg`;
  execFileSync("python", ["-c", `from PIL import Image, ImageOps\nim=Image.open(r'${src}').convert('RGB')\nim=ImageOps.fit(im,(1280,720),Image.LANCZOS)\nim.save(r'${dst}',quality=84,optimize=True,progressive=True)`]);
  n++;
}
console.log("covers written:", n);
