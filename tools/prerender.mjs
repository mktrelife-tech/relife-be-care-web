/* ============================================================
   tools/prerender.mjs — ทำ SEO / GEO / AEO ให้เว็บที่สร้างหน้าด้วย JavaScript

   ปัญหา: หน้าสินค้า/บทความ/รายการสินค้าถูกวาดด้วย JS ทีหลัง แต่ AI crawler หลายตัว
   (GPTBot, ClaudeBot, PerplexityBot ฯลฯ) ไม่รัน JavaScript → เห็นหน้าว่าง

   สคริปต์นี้เขียนเนื้อหาจริง + โครงสร้างข้อมูล (JSON-LD) ลงไฟล์ HTML ล่วงหน้า
   คนเปิดเว็บตามปกติ JS จะวาดทับเนื้อหาเดิมเหมือนเดิม (ไม่ซ้ำ ไม่เปลี่ยนหน้าตา)

   รันซ้ำได้ไม่จำกัด (แทนที่ระหว่าง <!--SEO:xxx--> ... <!--/SEO:xxx--> เท่านั้น)
     node tools/prerender.mjs
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOMAIN = "https://www.hopefulrelife.com";
const TODAY = new Date().toISOString().slice(0, 10);

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), s); };
const json = (f) => JSON.parse(read(f));

const prodData = json("content/products.json");
const PRODUCTS = prodData.products || prodData;
const SITE = json("content/site.json");
const artData = json("content/articles.json");
const ARTICLES = artData.articles || artData;

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const abs = (p) => p ? (/^https?:/.test(p) ? p : DOMAIN + "/" + String(p).replace(/^\.?\//, "").split("?")[0]) : undefined;
const baht = (n) => Number(n).toLocaleString("en-US");
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const ldTag = (obj) => `<script type="application/ld+json" data-seo>${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

/* แทนที่ข้อความระหว่าง marker ถ้ามีแล้ว ไม่งั้นแทรกตามตำแหน่งที่กำหนด */
function block(html, name, content, insert) {
  const open = `<!--SEO:${name}-->`, close = `<!--/SEO:${name}-->`;
  const wrapped = open + content + close;
  const re = new RegExp(open.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?" + close.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (re.test(html)) return html.replace(re, () => wrapped);
  const out = insert(html, wrapped);
  if (out === html) throw new Error(`หาจุดแทรก SEO:${name} ไม่เจอ`);
  return out;
}
const beforeHeadEnd = (html, w) => html.replace("</head>", () => w + "\n</head>");
const insideId = (id) => (html, w) => html.replace(new RegExp(`(<[a-z]+[^>]*id="${id}"[^>]*>)`), (m) => m + w);

function setHead(html, { title, desc, canonical, image, type }) {
  if (title) html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(title)}</title>`);
  if (desc) {
    html = /<meta name="description"[^>]*>/.test(html)
      ? html.replace(/<meta name="description"[^>]*>/, () => `<meta name="description" content="${esc(desc)}">`)
      : html.replace("</title>", () => `</title>\n<meta name="description" content="${esc(desc)}">`);
  }
  const og = [
    canonical && `<link rel="canonical" href="${canonical}">`,
    `<meta property="og:type" content="${type || "website"}">`,
    `<meta property="og:site_name" content="Hopeful Relife">`,
    `<meta property="og:locale" content="th_TH">`,
    title && `<meta property="og:title" content="${esc(title)}">`,
    desc && `<meta property="og:description" content="${esc(desc)}">`,
    canonical && `<meta property="og:url" content="${canonical}">`,
    image && `<meta property="og:image" content="${image}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    title && `<meta name="twitter:title" content="${esc(title)}">`,
    desc && `<meta name="twitter:description" content="${esc(desc)}">`,
    image && `<meta name="twitter:image" content="${image}">`
  ].filter(Boolean).join("\n");
  /* ลบแท็ก canonical / og / twitter เดิมที่อยู่นอก marker แล้วใส่ชุดใหม่ใน marker */
  html = html.replace(/[ \t]*<link rel="canonical"[^>]*>\n?/g, "")
             .replace(/[ \t]*<meta (property="og:|name="twitter:)[^>]*>\n?/g, "");
  return block(html, "meta", "\n" + og + "\n", beforeHeadEnd);
}

/* ---------- ข้อมูลร้าน (ใช้ซ้ำหลายที่) ---------- */
const C = SITE.contact || {}, B = SITE.business || {};
const ORG = {
  "@type": "Organization",
  "@id": DOMAIN + "/#org",
  name: "Hopeful Relife",
  legalName: B.legalName,
  url: DOMAIN,
  logo: abs(SITE.brand && SITE.brand.logo),
  telephone: "+66" + String(C.phoneRaw || "").replace(/^0/, ""),
  sameAs: [C.lineUrl].filter((x) => x && /^https?:/.test(x)),
  description: "ตัวแทนจำหน่ายอย่างเป็นทางการของผลิตภัณฑ์เสริมอาหารและเครื่องสำอางแบรนด์ HOPEFUL (รหัสตัวแทน " + (B.distributorId || "") + ")"
};
const sellerNote = `จำหน่ายโดย ${esc(B.legalName || "บริษัท รีไลฟ์ โซลูชั่นส์ จำกัด")} ตัวแทนจำหน่ายอย่างเป็นทางการของ HOPEFUL (รหัส ${esc(B.distributorId || "")}) · โทร ${esc(C.phone || "")} · LINE ${esc(C.lineId || "")}`;
const ship = SITE.shipping || {};
const shopFacts = [
  ship.fee === 0 ? "ส่งฟรีทั่วไทย" : null,
  ship.cod ? "มีบริการเก็บเงินปลายทาง" : null,
  SITE.payment && SITE.payment.installment ? "ผ่อน 0% ได้" : null,
  ship.leadTime ? "ระยะเวลาจัดส่ง: " + ship.leadTime : null
].filter(Boolean);

const isCosmetic = (p) => /เครื่องสำอาง/.test(p.fda || "") || /cream/.test(p.slug);
const kind = (p) => isCosmetic(p) ? "ผลิตภัณฑ์บำรุงผิว (เครื่องสำอาง)" : "ผลิตภัณฑ์เสริมอาหาร";
const unitWord = (p) => p.packUnit || (isCosmetic(p) ? "หลอด" : "กล่อง");
const productUrl = (p) => `${DOMAIN}/p/${p.slug}.html`;
const productImg = (p) => abs((p.sectionImages && p.sectionImages.hero) || p.header || (p.images && p.images[0]) || ((p.packs || [])[0] || {}).image);
const productTitle = (p) => `${p.name} (${p.nameTh}) — ${p.tagline} | Hopeful Relife`;

/* ============================================================
   1) หน้าสินค้า p/<slug>.html
   ============================================================ */
function productBody(p) {
  const u = unitWord(p);
  const li = (arr, f) => (arr || []).map(f).join("");
  const packs = (p.packs || []).slice().sort((a, b) => a.qty - b.qty);
  const parts = [];

  parts.push(`<h1>${esc(p.name)} (${esc(p.nameTh)}) — ${esc(p.tagline)}</h1>`);
  /* สรุปแบบตอบคำถามทันที (Answer-first) — AI มักดึงย่อหน้าแรกไปตอบ */
  parts.push(`<p><strong>${esc(p.name)} คืออะไร?</strong> ${esc(p.name)} (${esc(p.nameTh)}) เป็น${kind(p)}จากแบรนด์ HOPEFUL ${esc(p.short || p.tagline)} ` +
    `เลขทะเบียน อย. ${esc(String(p.fda || "").replace(/^อย\.\s*/, ""))} · ${esc(p.unit || "")} · ราคาเริ่มต้น ${baht(p.price)} บาท</p>`);

  if (p.benefits && p.benefits.length) parts.push(`<ul>${li(p.benefits, (b) => `<li>${esc(b)}</li>`)}</ul>`);

  (p.story || []).forEach((s) => {
    parts.push(`<h2>${esc(s.title)}</h2><p>${esc(s.body)}</p>`);
  });

  if (p.highlights && p.highlights.length) {
    parts.push(`<h2>จุดเด่นของ ${esc(p.name)}</h2><ul>${li(p.highlights, (h) => `<li><strong>${esc(h.t)}</strong>${h.d ? " — " + esc(h.d) : ""}</li>`)}</ul>`);
  }
  if (p.forWhoList && p.forWhoList.length) {
    parts.push(`<h2>${esc(p.name)} เหมาะกับใคร</h2><ul>${li(p.forWhoList, (h) => `<li><strong>${esc(h.t)}</strong>${h.d ? " — " + esc(h.d) : ""}</li>`)}</ul>`);
  } else if (p.forWho) {
    parts.push(`<h2>${esc(p.name)} เหมาะกับใคร</h2><p>${esc(p.forWho)}</p>`);
  }
  if (p.ingredients && p.ingredients.length) {
    parts.push(`<h2>ส่วนประกอบสำคัญของ ${esc(p.name)}</h2><table><thead><tr><th>ส่วนประกอบ</th><th>ปริมาณ</th></tr></thead><tbody>` +
      li(p.ingredients, (i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.amount || "—")}</td></tr>`) + `</tbody></table>`);
  }
  if (p.howto) parts.push(`<h2>วิธี${isCosmetic(p) ? "ใช้" : "รับประทาน"} ${esc(p.name)}</h2><p>${esc(p.howto)}</p>`);

  if (packs.length) {
    const one = packs[0].price / (packs[0].qty || 1);
    parts.push(`<h2>ราคา ${esc(p.name)} และโปรโมชั่น</h2><table><thead><tr><th>แพ็ก</th><th>ราคา</th><th>เฉลี่ยต่อ${u}</th></tr></thead><tbody>` +
      li(packs, (k) => {
        const save = Math.round(one * k.qty - k.price);
        return `<tr><td>${k.qty} ${u}</td><td>${baht(k.price)} บาท</td><td>${baht(Math.round(k.price / k.qty))} บาท${save > 0 ? ` (ประหยัด ${baht(save)} บาท)` : ""}</td></tr>`;
      }) + `</tbody></table>`);
    if (shopFacts.length) parts.push(`<p>${esc(shopFacts.join(" · "))}</p>`);
  }

  if (p.faq && p.faq.length) {
    parts.push(`<h2>คำถามที่พบบ่อยเกี่ยวกับ ${esc(p.name)}</h2>` + li(p.faq, (f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`));
  }
  if (p.warning || p.notFor) {
    parts.push(`<h2>คำเตือนและข้อควรระวัง</h2>` + (p.warning ? `<p>${esc(p.warning)}</p>` : "") +
      (p.notFor ? `<p>ผู้ที่ไม่ควร${isCosmetic(p) ? "ใช้" : "รับประทาน"}: ${esc(p.notFor)}</p>` : ""));
  }
  parts.push(`<p>${sellerNote}</p>`);
  if (SITE.disclaimer && !isCosmetic(p)) parts.push(`<p><small>${esc(SITE.disclaimer)}</small></p>`);

  return `<section class="section"><div class="wrap seo-static" style="max-width:880px">${parts.join("\n")}</div></section>`;
}

function productLd(p) {
  const url = productUrl(p);
  const packs = (p.packs || []).slice().sort((a, b) => a.qty - b.qty);
  const prices = packs.map((k) => k.price);
  const offers = packs.length ? {
    "@type": "AggregateOffer",
    priceCurrency: "THB",
    lowPrice: Math.min(...prices),
    highPrice: Math.max(...prices),
    offerCount: packs.length,
    offers: packs.map((k) => ({
      "@type": "Offer",
      name: `${p.name} ${k.qty} ${unitWord(p)}`,
      price: k.price, priceCurrency: "THB",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      url, seller: { "@id": DOMAIN + "/#org" }
    }))
  } : { "@type": "Offer", price: p.price, priceCurrency: "THB", availability: "https://schema.org/InStock", url };

  const graph = [
    ORG,
    {
      "@type": "Product",
      "@id": url + "#product",
      name: p.name,
      alternateName: p.nameTh,
      description: p.short || p.tagline,
      image: [productImg(p), ...(p.packs || []).map((k) => abs(k.image))].filter(Boolean).slice(0, 6),
      brand: { "@type": "Brand", name: "HOPEFUL" },
      sku: p.slug,
      category: kind(p),
      url,
      additionalProperty: [
        { "@type": "PropertyValue", name: "เลข อย.", value: String(p.fda || "").replace(/^อย\.\s*/, "") },
        p.unit && { "@type": "PropertyValue", name: "ขนาดบรรจุ", value: p.unit }
      ].filter(Boolean),
      offers
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "หน้าแรก", item: DOMAIN + "/" },
        { "@type": "ListItem", position: 2, name: "สินค้าทั้งหมด", item: DOMAIN + "/shop.html" },
        { "@type": "ListItem", position: 3, name: p.name, item: url }
      ]
    }
  ];
  if (p.faq && p.faq.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": url + "#faq",
      mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
    });
  }
  return ldTag({ "@context": "https://schema.org", "@graph": graph });
}

let count = { products: 0, blog: 0 };
for (const p of PRODUCTS) {
  const f = `p/${p.slug}.html`;
  if (!fs.existsSync(path.join(ROOT, f))) { console.warn("ข้าม (ไม่มีไฟล์):", f); continue; }
  let html = read(f);
  html = setHead(html, {
    title: productTitle(p),
    desc: clip(p.short || p.tagline, 158),
    canonical: productUrl(p),
    image: productImg(p),
    type: "product"
  });
  html = block(html, "ld", "\n" + productLd(p) + "\n", beforeHeadEnd);
  html = html.replace(/<span id="crumbName">[^<]*<\/span>/, () => `<span id="crumbName">${esc(p.name)}</span>`);
  html = block(html, "body", productBody(p), insideId("pdpSections"));
  write(f, html);
  count.products++;
}

/* ============================================================
   2) บทความ — สร้างหน้า static blog/<slug>.html จาก article.html
   ============================================================ */
function mdToHtml(src) {
  return String(src || "").split(/\n{2,}/).map((blk) => {
    blk = esc(blk.trim());
    if (!blk) return "";
    if (/^### /.test(blk)) return "<h3>" + blk.replace(/^### /, "") + "</h3>";
    if (/^## /.test(blk)) return "<h2>" + blk.replace(/^## /, "") + "</h2>";
    if (/^[-*] /m.test(blk)) return "<ul>" + blk.split("\n").map((l) => "<li>" + l.replace(/^[-*]\s*/, "") + "</li>").join("") + "</ul>";
    return "<p>" + blk.replace(/\n/g, "<br>") + "</p>";
  }).join("")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="art-link" href="$2">$1</a>');
}

/* ใส่ ../ ให้ path แบบ relative (เพราะหน้าอยู่ในโฟลเดอร์ blog/) — ไม่แตะโค้ดใน <script> */
function relocate(html) {
  const fix = (s) => s.replace(/\b(href|src)="(?!https?:|\/|#|\.\.\/|data:|mailto:|tel:|')([^"]+)"/g, '$1="../$2"');
  return html.split(/(<script[\s\S]*?<\/script>)/).map((part) => {
    if (!part.startsWith("<script")) return fix(part);
    const end = part.indexOf(">") + 1;
    return fix(part.slice(0, end)) + part.slice(end);
  }).join("");
}

const articleTpl = read("article.html")
  .replace(/[ \t]*<meta name="robots"[^>]*>\n?/, "")
  .replace(/<!--SEO:[a-z]+-->[\s\S]*?<!--\/SEO:[a-z]+-->/g, "");

const blogUrl = (a) => `${DOMAIN}/blog/${a.slug}.html`;
for (const a of ARTICLES) {
  const prod = PRODUCTS.find((x) => x.slug === a.product);
  const body =
    `<span class="eyebrow">${esc(a.category)}</span>` +
    `<h1>${esc(a.title)}</h1>` +
    `<p>เผยแพร่ ${esc(a.date)} · โดย Hopeful Relife</p>` +
    `<p><strong>${esc(a.excerpt)}</strong></p>` +
    `<div>${mdToHtml(a.body)}</div>` +
    (prod ? `<p>อ่านข้อมูลผลิตภัณฑ์ที่เกี่ยวข้อง: <a href="../p/${prod.slug}.html">${esc(prod.name)} (${esc(prod.nameTh)})</a></p>` : "");

  const ld = ldTag({
    "@context": "https://schema.org",
    "@graph": [
      ORG,
      {
        "@type": "BlogPosting",
        "@id": blogUrl(a) + "#article",
        headline: a.title,
        description: a.excerpt,
        image: abs(a.cover),
        datePublished: a.date,
        dateModified: a.updated || a.date,
        inLanguage: "th-TH",
        author: { "@id": DOMAIN + "/#org" },
        publisher: { "@id": DOMAIN + "/#org" },
        mainEntityOfPage: blogUrl(a),
        articleSection: a.category,
        about: prod ? { "@type": "Product", name: prod.name, url: productUrl(prod) } : undefined
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "หน้าแรก", item: DOMAIN + "/" },
          { "@type": "ListItem", position: 2, name: "บทความ", item: DOMAIN + "/articles.html" },
          { "@type": "ListItem", position: 3, name: a.title, item: blogUrl(a) }
        ]
      }
    ]
  });

  let html = articleTpl.replace("<body>", () => `<body data-slug="${esc(a.slug)}">`);
  html = setHead(html, {
    title: `${a.title} — Hopeful Relife`,
    desc: clip(a.excerpt, 158),
    canonical: blogUrl(a),
    image: abs(a.cover),
    type: "article"
  });
  html = block(html, "ld", "\n" + ld + "\n", beforeHeadEnd);
  html = block(html, "body", body, insideId("post"));
  write(`blog/${a.slug}.html`, relocate(html));
  count.blog++;
}

/* article.html (แบบ ?slug=) กลายเป็นหน้าสำรอง — กันซ้ำกับ blog/ ใน Google */
{
  let html = read("article.html");
  if (!/<meta name="robots"/.test(html)) html = html.replace("</title>", '</title>\n<meta name="robots" content="noindex, follow">');
  write("article.html", html);
}

/* ============================================================
   3) หน้าแรก + หน้าร้าน — รายการสินค้าแบบ static + FAQ ร้าน
   ============================================================ */
const staticCards = PRODUCTS.map((p) =>
  `<article class="card"><a class="card__media" href="p/${p.slug}.html">${productImg(p) ? `<img src="${esc(productImg(p).replace(DOMAIN + "/", ""))}" alt="${esc(p.name)} ${esc(p.nameTh)}" loading="lazy">` : ""}</a>` +
  `<div class="card__body"><h3 class="card__name"><a href="p/${p.slug}.html">${esc(p.name)} (${esc(p.nameTh)})</a></h3>` +
  `<p class="card__desc">${esc(p.tagline)}</p><p class="card__fda">อย. ${esc(String(p.fda || "").replace(/^อย\.\s*/, ""))} · เริ่มต้น ${baht(p.price)} บาท</p></div></article>`
).join("");

const itemListLd = {
  "@type": "ItemList",
  name: "สินค้าทั้งหมด Hopeful Relife",
  itemListElement: PRODUCTS.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: productUrl(p), name: p.name }))
};

/* คำถามที่คนถามบ่อยเกี่ยวกับร้าน — ตอบตรงไปตรงมา ใช้ทั้งแสดงบนหน้า และ FAQPage schema */
const SHOP_FAQ = [
  { q: "ซื้อสินค้า HOPEFUL ของแท้ได้ที่ไหน?", a: `ซื้อได้ที่ Hopeful Relife (hopefulrelife.com) ซึ่งดำเนินการโดย ${B.legalName || "บริษัท รีไลฟ์ โซลูชั่นส์ จำกัด"} ตัวแทนจำหน่ายอย่างเป็นทางการของ HOPEFUL รหัสตัวแทน ${B.distributorId || ""} ตรวจสอบเอกสารแต่งตั้งได้ที่หน้าเกี่ยวกับเรา` },
  { q: "สินค้ามีเลข อย. หรือไม่?", a: "ทุกรายการมีเลขทะเบียน อย. หรือเลขจดแจ้งเครื่องสำอาง แสดงไว้ในหน้าสินค้าแต่ละตัว และตรวจสอบได้ที่เว็บไซต์ของสำนักงานคณะกรรมการอาหารและยา" },
  { q: "ค่าส่งเท่าไหร่ และส่งกี่วันได้รับ?", a: `${ship.fee === 0 ? "ส่งฟรีทั่วไทย ไม่มีขั้นต่ำ" : "ค่าส่ง " + ship.fee + " บาท"} จัดส่งโดย ${ship.carriers || "บริษัทขนส่ง"} ${ship.leadTime || ""}` },
  { q: "เก็บเงินปลายทางได้ไหม?", a: ship.cod ? "ได้ เลือก “เก็บเงินปลายทาง (COD)” ตอนสั่งซื้อ แล้วชำระกับพนักงานส่งของเมื่อได้รับสินค้า" : "ขณะนี้ยังไม่มีบริการเก็บเงินปลายทาง" },
  { q: "ผ่อนชำระได้ไหม?", a: SITE.payment && SITE.payment.installment ? "ผ่อน 0% ได้ ผ่านบัตรเครดิต ตามเงื่อนไขธนาคารที่ร่วมรายการ หรือทัก LINE ให้แอดมินช่วยจัดการผ่อนให้" : "ขณะนี้ยังไม่มีบริการผ่อนชำระ" },
  { q: "ไม่แน่ใจว่าควรเลือกตัวไหน ปรึกษาได้ไหม?", a: `ปรึกษาทีมงานได้ฟรี ไม่ต้องซื้อก็ถามได้ ทาง LINE ${C.lineId || ""} หรือโทร ${C.phone || ""} (${C.openHours || ""}) และมีแบบประเมิน 1 นาทีที่หน้า “ตัวไหนเหมาะกับคุณ”` }
];
const shopFaqHtml =
  `<section class="section" id="shop-faq"><div class="wrap" style="max-width:780px">` +
  `<div class="sec-head"><span class="eyebrow">คำถามที่พบบ่อย</span><h2>สั่งซื้อกับ Hopeful Relife</h2></div>` +
  `<div class="faq">` + SHOP_FAQ.map((f) => `<details><summary>${esc(f.q)}<span></span></summary><div class="faq__a">${esc(f.a)}</div></details>`).join("") +
  `</div></div></section>`;
const shopFaqLd = { "@type": "FAQPage", "@id": DOMAIN + "/#faq", mainEntity: SHOP_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };

{
  let html = read("index.html");
  html = block(html, "ld", "\n" + ldTag({
    "@context": "https://schema.org",
    "@graph": [
      ORG,
      { "@type": "WebSite", "@id": DOMAIN + "/#website", url: DOMAIN + "/", name: "Hopeful Relife", inLanguage: "th-TH", publisher: { "@id": DOMAIN + "/#org" } },
      itemListLd,
      shopFaqLd
    ]
  }) + "\n", beforeHeadEnd);
  html = block(html, "cards", staticCards, insideId("productsGrid"));
  html = block(html, "faq", shopFaqHtml, (h, w) => h.replace('<div id="site-footer">', () => w + '\n<div id="site-footer">'));
  write("index.html", html);
}
{
  let html = read("shop.html");
  html = block(html, "ld", "\n" + ldTag({ "@context": "https://schema.org", "@graph": [ORG, itemListLd] }) + "\n", beforeHeadEnd);
  html = block(html, "cards", staticCards, insideId("grid"));
  write("shop.html", html);
}
{
  /* หน้ารวมบทความ — รายการลิงก์ static */
  let html = read("articles.html");
  const list = ARTICLES.map((a) => `<a class="article-card" href="blog/${a.slug}.html"><div class="article-card__body"><span class="article-card__cat">${esc(a.category)}</span><h3>${esc(a.title)}</h3><p>${esc(clip(a.excerpt, 140))}</p></div></a>`).join("");
  const id = (html.match(/id="(articles|list|grid|articleList)"/) || [])[1];
  if (id) html = block(html, "cards", list, insideId(id));
  write("articles.html", html);
}

/* ============================================================
   4) sitemap.xml / robots.txt / llms.txt / llms-full.txt
   ============================================================ */
const pages = [
  ["/", "1.0"], ["/shop.html", "0.9"], ["/articles.html", "0.7"], ["/about.html", "0.6"],
  ["/quiz.html", "0.6"], ["/consult.html", "0.5"], ["/contact.html", "0.5"], ["/policy.html", "0.3"]
];
const sm = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
  ...pages.map(([u, pr]) => `  <url><loc>${DOMAIN}${u}</loc><lastmod>${TODAY}</lastmod><priority>${pr}</priority></url>`),
  ...PRODUCTS.map((p) => `  <url><loc>${productUrl(p)}</loc><lastmod>${TODAY}</lastmod><priority>0.8</priority>` +
    (productImg(p) ? `<image:image><image:loc>${productImg(p)}</image:loc></image:image>` : "") + `</url>`),
  ...ARTICLES.map((a) => `  <url><loc>${blogUrl(a)}</loc><lastmod>${a.updated || a.date}</lastmod><priority>0.7</priority>` +
    (a.cover ? `<image:image><image:loc>${abs(a.cover)}</image:loc></image:image>` : "") + `</url>`),
  `</urlset>`, ""
].join("\n");
write("sitemap.xml", sm);

write("robots.txt", [
  "# อนุญาตเครื่องมือค้นหาและ AI ทุกตัวให้อ่านเนื้อหาสินค้าและบทความ",
  "User-agent: *",
  "Allow: /",
  "Disallow: /admin/",
  "Disallow: /api/",
  "Disallow: /content/orders.json",
  "Disallow: /checkout.html",
  "Disallow: /thankyou.html",
  "Disallow: /order.html",
  "",
  "# AI search / answer engines (ระบุชัดเพื่อให้แน่ใจว่าไม่ถูกบล็อก)",
  ...["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Bingbot"]
    .map((b) => `User-agent: ${b}\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /checkout.html\nDisallow: /thankyou.html\nDisallow: /order.html\n`),
  `Sitemap: ${DOMAIN}/sitemap.xml`, ""
].join("\n"));

const fdaOf = (p) => String(p.fda || "").replace(/^อย\.\s*/, "");
write("llms.txt", [
  "# Hopeful Relife (hopefulrelife.com)",
  "",
  `> ตัวแทนจำหน่ายอย่างเป็นทางการของผลิตภัณฑ์เสริมอาหารและเครื่องสำอางแบรนด์ HOPEFUL ดำเนินการโดย ${B.legalName || ""} (รหัสตัวแทน ${B.distributorId || ""}) ทุกรายการมีเลข อย. ตรวจสอบได้ ${shopFacts.join(" · ")}`,
  "",
  "ข้อมูลฉบับเต็ม (ส่วนผสม ราคาแพ็ก วิธีใช้ คำถามที่พบบ่อย): " + DOMAIN + "/llms-full.txt",
  "",
  "## สินค้า",
  ...PRODUCTS.map((p) => `- [${p.name} (${p.nameTh})](${productUrl(p)}): ${p.tagline} · ${kind(p)} · อย. ${fdaOf(p)} · เริ่มต้น ${baht(p.price)} บาท`),
  "",
  "## บทความ",
  ...ARTICLES.map((a) => `- [${a.title}](${blogUrl(a)}): ${clip(a.excerpt, 120)}`),
  "",
  "## ข้อมูลร้าน",
  `- [เกี่ยวกับเรา / เอกสารแต่งตั้งตัวแทน](${DOMAIN}/about.html)`,
  `- [การจัดส่ง การคืนสินค้า นโยบาย](${DOMAIN}/policy.html)`,
  `- [ติดต่อ](${DOMAIN}/contact.html): โทร ${C.phone || ""} · LINE ${C.lineId || ""} · ${C.openHours || ""}`,
  "",
  "## หมายเหตุ",
  "- สินค้าเป็นผลิตภัณฑ์เสริมอาหาร/เครื่องสำอาง ไม่ใช่ยา ไม่มีผลในการป้องกันหรือรักษาโรค",
  ""
].join("\n"));

const full = [
  "# Hopeful Relife — ข้อมูลสินค้าฉบับเต็ม",
  "",
  `> ${ORG.description} · ${shopFacts.join(" · ")}`,
  ""
];
for (const p of PRODUCTS) {
  full.push(`## ${p.name} (${p.nameTh})`, "", `URL: ${productUrl(p)}`, `ประเภท: ${kind(p)}`, `เลข อย.: ${fdaOf(p)}`, `ขนาด: ${p.unit || ""}`, "", p.short || p.tagline, "");
  if (p.benefits && p.benefits.length) full.push(...p.benefits.map((b) => `- ${b}`), "");
  if (p.forWhoList && p.forWhoList.length) full.push("### เหมาะกับใคร", ...p.forWhoList.map((h) => `- ${h.t}${h.d ? ": " + h.d : ""}`), "");
  if (p.ingredients && p.ingredients.length) full.push("### ส่วนประกอบสำคัญ", ...p.ingredients.map((i) => `- ${i.name}${i.amount && i.amount !== "—" ? " " + i.amount : ""}`), "");
  if (p.howto) full.push(`### วิธี${isCosmetic(p) ? "ใช้" : "รับประทาน"}`, p.howto, "");
  if (p.packs && p.packs.length) full.push("### ราคา", ...p.packs.slice().sort((a, b) => a.qty - b.qty).map((k) => `- ${k.qty} ${unitWord(p)}: ${baht(k.price)} บาท`), "");
  if (p.faq && p.faq.length) full.push("### คำถามที่พบบ่อย", ...p.faq.flatMap((f) => [`**${f.q}**`, f.a, ""]));
  if (p.warning) full.push("### คำเตือน", p.warning, "");
}
full.push("## คำถามที่พบบ่อยเกี่ยวกับการสั่งซื้อ", "", ...SHOP_FAQ.flatMap((f) => [`**${f.q}**`, f.a, ""]));
write("llms-full.txt", full.join("\n"));

console.log(`prerender เสร็จ: สินค้า ${count.products} หน้า · บทความ ${count.blog} หน้า · sitemap ${PRODUCTS.length + ARTICLES.length + pages.length} URL`);
