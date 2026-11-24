// แก้เฉพาะแผงแคปซูลในปกที่มีอยู่ ให้ตรงกับแผงจริง (.covers-work/box/blister-real.png: แนวตั้ง 2 คอลัมน์×5 แถว เรียงตรงเป็นตาราง แคปซูลนอนขวาง)
//   node tools/covers/fix-blister.mjs <slug>=<ภาพต้นฉบับ>=<สีแคปซูล> ...
// ผลลัพธ์ .covers-work/blister/<slug>.png (ส่วนอื่นของภาพต้องเหมือนเดิม — ตรวจทุกใบก่อนใช้)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")).replace(/%20/g, " "), "../..");
const OUT = path.join(ROOT, ".covers-work/blister");
fs.mkdirSync(OUT, { recursive: true });
const cfg = fs.readFileSync(path.join(process.env.USERPROFILE, ".codex/config.toml"), "utf8");
const appDir = (cfg.match(/(C:\\\\Program Files\\\\WindowsApps\\\\OpenAI\.Codex_[^\\]+)/) || [])[1];
const CODEX_EXE = process.env.CODEX_EXE || (appDir ? appDir.replace(/\\\\/g, "/") + "/app/resources/codex.exe" : "");
const jobs = process.argv.slice(2).map((a) => { const [slug, src, color, mode] = a.split("="); return { slug, src, color: color || "white", mode }; });

const prompt = (j) => `Use your built-in image generation tool to EDIT the first attached image. Change ONLY the capsule blister strip(s) in it; keep everything else exactly the same — same person, face, pose, hands, text, headline, boxes, props, background, colors and framing. The second attached image is a straight-on photo of the REAL blister strip: redraw every blister strip in the first image to match it exactly — a straight, aligned grid: a silver dotted-foil card in PORTRAIT orientation (taller than wide) holding EXACTLY 10 ${j.color} capsules in 2 columns × 5 rows, each capsule lying HORIZONTALLY (its long axis across the card's width) inside its own clear bubble, left and right capsules of each row perfectly side by side at the same height, with a narrow foil margin around them. Not 3 columns, not 12 capsules, not capsules standing vertically, not a landscape card. ${j.mode === 'beside' ? 'REMOVE the blister strip that lies flat on the table (fill that area with the same wooden table and nearby loose capsules). The THIRD attached image is the real BETALIFE box: the box in the picture must look exactly like it — keep the box front fully visible and unchanged (logo, BETALIFE wordmark, Thai/English text, brown band), nothing may cover it. Then add ONE blister strip standing UPRIGHT on the table just to the RIGHT of the box (in front of the reishi mushrooms), not overlapping the box, facing the camera straight-on so it looks exactly like the second attached photo (portrait card, 2 columns × 5 rows, 10 capsules lying horizontally), slightly shorter than the box;' : j.mode === 'upright' ? 'REMOVE the blister strip that lies flat on the table (fill that area with the same wooden table, leaves and loose capsules that are already nearby) and instead show ONE blister strip standing UPRIGHT, leaning against the lower-right front of the BETALIFE box, facing the camera straight-on so it looks exactly like the attached photo (portrait card, 2 columns × 5 rows, 10 capsules lying horizontally), at a realistic size — slightly shorter than the box height;' : 'Keep each strip at the same position, size, angle and lighting as in the original image,'} and keep the capsule color ${j.color}. Output the full edited image at the same aspect ratio. Save it into the current working directory as ${j.slug}.png and print its path.`;

function run(j) {
  return new Promise((resolve) => {
    const a = path.join(OUT, `_${j.slug}-src${path.extname(j.src)}`), b = path.join(OUT, `_${j.slug}-ref.png`);
    fs.copyFileSync(j.src, a); fs.copyFileSync(path.join(ROOT, ".covers-work/box/blister-front.png"), b);
    const log = fs.openSync(path.join(OUT, `_${j.slug}.log`), "w");
    const extra = j.mode === "beside" ? [path.join(ROOT, ".covers-work/box/beta-life.png")] : [];
    const ch = spawn(CODEX_EXE, ["exec", "--skip-git-repo-check", "--sandbox", "workspace-write", prompt(j), "-i", a, b, ...extra], { cwd: OUT, stdio: ["ignore", log, log] });
    const t = setTimeout(() => ch.kill(), 9 * 60 * 1000);
    ch.on("exit", () => { clearTimeout(t); const ok = fs.existsSync(path.join(OUT, j.slug + ".png")); console.log((ok ? "ok   " : "FAIL ") + j.slug); resolve(ok); });
  });
}
let i = 0;
await Promise.all(Array.from({ length: 3 }, async () => { while (i < jobs.length) await run(jobs[i++]); }));
