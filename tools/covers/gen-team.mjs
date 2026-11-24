// ปกบทความสไตล์ "ปกทีม" (พรีเซนเตอร์เสื้อโปโลกรมท่า RELIFE + หัวข้อใหญ่ 2 บรรทัด + กล่องจริง) ด้วย Codex
//   node tools/covers/gen-team.mjs [slug ...]   (ข้ามใบที่มีแล้ว; ลบไฟล์ใน .covers-work/team/ เพื่อทำใหม่)
// สเปก: tools/covers/covers-team.json  { slug, ref, products[], l1, l2, color, scene }
//   ref = ปกทีมที่ใช้เป็นต้นแบบ (assets/img/articles/cover-<ref>.jpg)  products = ไฟล์ใน .covers-work/box/<name>.png
// ผลลัพธ์ .covers-work/team2/<slug>.png → node tools/covers/finish-full.mjs team
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")).replace(/%20/g, " "), "../..");
const OUT = path.join(ROOT, ".covers-work/team2");
fs.mkdirSync(OUT, { recursive: true });
const cfg = fs.readFileSync(path.join(process.env.USERPROFILE, ".codex/config.toml"), "utf8");
const appDir = (cfg.match(/(C:\\\\Program Files\\\\WindowsApps\\\\OpenAI\.Codex_[^\\]+)/) || [])[1];
const CODEX_EXE = process.env.CODEX_EXE || (appDir ? appDir.replace(/\\\\/g, "/") + "/app/resources/codex.exe" : "");
if (!CODEX_EXE || !fs.existsSync(CODEX_EXE)) { console.error("ไม่พบ codex.exe — ตั้ง CODEX_EXE เอง"); process.exit(1); }
const specs = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/covers/covers-team.json"), "utf8"));
const only = process.argv.slice(2);
const todo = specs.filter((s) => (!only.length || only.includes(s.slug)) && !fs.existsSync(path.join(OUT, s.slug + ".png")));

function prompt(s) {
  const n = s.products.length;
  const prod = n
    ? ` Attached images 2${n > 1 ? "–" + (n + 1) : ""} show the REAL product packaging: include ${n > 1 ? "these exact products" : "this exact product"} (same artwork, colors, logo and text — do not redesign, rename or invent boxes) standing on the table in the foreground, large and sharp like in the style reference, with their real proportions and a soft realistic shadow.`
    : ` Keep the product boxes on the table exactly as they appear in the style reference (same real HOPEFUL packaging, do not invent new boxes).`;
  return `Use your built-in image generation tool to create ONE finished blog cover image, landscape 16:9. The first attached image is the STYLE reference from the same cover series: match it closely — the SAME presenter (same Thai man, same face and hair, navy polo shirt with the RELIFE logo, smartwatch) on the right side seated at a light table, a bright airy room background with soft greenery and bokeh, a very large bold Thai headline on the left where line 1 is big bold text and line 2 sits inside a rounded glossy pill banner, a thin gold swoosh under the headline, small fresh natural props on the table. Use a ${s.color} color theme for the headline and pill banner.${prod} Presenter pose/scene: ${s.scene}. TYPOGRAPHY (important): headline line 1 must use the same wide, rounded, extra-bold Thai typeface as line 1 of the style reference, with natural full-width letter shapes and normal letter spacing — NEVER condensed, narrowed, squeezed or horizontally compressed; if the text is long, make the whole line smaller (or let it span wider across the image) instead of squeezing the letters. It must be easy to read on a small phone thumbnail. Thai text to render exactly, spelled precisely, and NOTHING else written anywhere except what is printed on the real packaging: headline line 1: '${s.l1}' ; headline line 2 (inside the pill banner): '${s.l2}'. Save the final image into the current working directory as ${s.slug}.png and print its path.`;
}

function run(s) {
  return new Promise((resolve) => {
    const style = path.join(OUT, `_${s.slug}-style.jpg`);
    fs.copyFileSync(path.join(ROOT, `assets/img/articles/cover-${s.ref}.jpg`), style);
    const imgs = [style];
    s.products.forEach((p, k) => {
      const f = path.join(OUT, `_${s.slug}-p${k}.png`);
      fs.copyFileSync(path.join(ROOT, `.covers-work/box/${p}.png`), f);
      imgs.push(f);
    });
    const log = fs.openSync(path.join(OUT, `_${s.slug}.log`), "w");
    const ch = spawn(CODEX_EXE, ["exec", "--skip-git-repo-check", "--sandbox", "workspace-write", prompt(s), "-i", ...imgs], { cwd: OUT, stdio: ["ignore", log, log] });
    const t = setTimeout(() => ch.kill(), 9 * 60 * 1000);
    ch.on("exit", () => { clearTimeout(t); const ok = fs.existsSync(path.join(OUT, s.slug + ".png")); console.log((ok ? "ok   " : "FAIL ") + s.slug); resolve(ok); });
  });
}

const N = 3;
let i = 0;
await Promise.all(Array.from({ length: N }, async () => { while (i < todo.length) await run(todo[i++]); }));
console.log("done:", fs.readdirSync(OUT).filter((f) => /^[a-z].*\.png$/.test(f)).length, "covers");
