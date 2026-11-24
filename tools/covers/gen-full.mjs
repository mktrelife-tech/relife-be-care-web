// สร้างปกบทความทั้งใบด้วย Codex (สไตล์ปกเก่าของเว็บ + รูปกล่องสินค้าจริงเป็นต้นแบบ)
//   node tools/covers/gen-full.mjs [slug ...]      (ข้ามใบที่มีแล้ว; ลบไฟล์ใน .covers-work/full/ เพื่อทำใหม่)
// ผลลัพธ์: .covers-work/full/<slug>.png  →  ใช้ finish-full.mjs ย่อเป็น assets/img/articles/cover-<slug>.jpg
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")).replace(/%20/g, " "), "../..");
const OUT = path.join(ROOT, ".covers-work/full");
fs.mkdirSync(OUT, { recursive: true });
/* หา codex.exe จากพาธแอป Codex ที่เขียนไว้ใน ~/.codex/config.toml (เปลี่ยนตามเวอร์ชันแอป) — หรือกำหนดเองด้วย CODEX_EXE */
const cfg = fs.readFileSync(path.join(process.env.USERPROFILE, ".codex/config.toml"), "utf8");
const appDir = (cfg.match(/(C:\\\\Program Files\\\\WindowsApps\\\\OpenAI\.Codex_[^\\]+)/) || [])[1];
const CODEX_EXE = process.env.CODEX_EXE || (appDir ? appDir.replace(/\\\\/g, "/") + "/app/resources/codex.exe" : "");
if (!CODEX_EXE || !fs.existsSync(CODEX_EXE)) { console.error("ไม่พบ codex.exe — ตั้ง CODEX_EXE เอง"); process.exit(1); }
const STYLE = { kidney: "assets/img/articles/cover-kidney.jpg", oils: "assets/img/articles/cover-oils.jpg" };
const specs = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/covers/covers-full.json"), "utf8"));
const only = process.argv.slice(2);
const todo = specs.filter((s) => (!only.length || only.includes(s.slug)) && !fs.existsSync(path.join(OUT, s.slug + ".png")));

function prompt(s) {
  const prod = s.product
    ? ` The second attached image shows the REAL product packaging: include this exact product (same artwork, colors, logo and text; do not redesign or rename it) placed naturally in the photo area at a modest size, correctly lit with a realistic shadow.${s.boxNote ? " " + s.boxNote : " Keep the box's real proportions (do not stretch it or make it deeper)."}`
    : ` Do not show any product packaging.`;
  return `Use your built-in image generation tool to create ONE finished blog cover image, landscape 16:9. The first attached image is the STYLE reference: match its layout and look closely — bright white/mint background, a white RELIFE | HOPEFUL logo badge in the top-right corner, a large Thai headline on the left in dark navy with the second line in teal-green, a thin divider and a smaller dark-grey subtitle, a row of 4 round mint line-icons with short Thai labels along the bottom-left, a soft teal wave at the bottom-left corner, and a bright, high-key photo on the right that fades softly into the white background. Copy ONLY the layout, colors and typography from the style reference — do NOT copy its kidney illustration or any organ/medical graphic, and do not add organ icons near the headline.${prod} Scene for the photo: ${s.scene}. Thai text to render exactly, spelled precisely, nothing else written: headline line 1: '${s.l1}' ; headline line 2: '${s.l2}' ; subtitle: '${s.sub}' ; the 4 icon labels: ${s.icons.map((x) => `'${x}'`).join(", ")}. Save the final image into the current working directory as ${s.slug}.png and print its path.`;
}

function run(s) {
  return new Promise((resolve) => {
    const style = path.join(OUT, `_${s.slug}-style.jpg`);
    fs.copyFileSync(path.join(ROOT, STYLE[s.style] || STYLE.kidney), style);
    const imgs = [style];
    if (s.product) {
      const p = path.join(OUT, `_${s.slug}-product.png`);
      fs.copyFileSync(path.join(ROOT, `.covers-work/box/${s.productRef || s.product}.png`), p);
      imgs.push(p);
    }
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
