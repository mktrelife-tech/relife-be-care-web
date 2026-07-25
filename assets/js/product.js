/* หน้ารายละเอียดสินค้า — อ่าน slug จาก <body data-slug="..."> */
document.addEventListener("site:ready", function (e) {
  var S = e.detail, A = window.App;
  var slug = document.body.dataset.slug;
  var p = S.products.filter(function (x) { return x.slug === slug; })[0];
  if (!p) { A.$("#pdp").innerHTML = "<p>ไม่พบสินค้านี้</p>"; return; }

  document.title = p.name + " — " + p.tagline + " | " + S.site.brand.name;
  var md = document.querySelector('meta[name="description"]');
  if (md) md.setAttribute("content", p.short);

  /* ---- โครงสร้างข้อมูลสำหรับ Google (Product schema) ---- */
  var ld = document.createElement("script");
  ld.type = "application/ld+json";
  ld.textContent = JSON.stringify({
    "@context": "https://schema.org", "@type": "Product",
    name: p.name, description: p.short, brand: { "@type": "Brand", name: p.name },
    offers: { "@type": "Offer", price: p.price, priceCurrency: "THB", availability: "https://schema.org/InStock" }
  });
  document.head.appendChild(ld);

  var imgs = (p.images && p.images.length) ? p.images : [];
  var mainImg = imgs.length
    ? '<img src="' + A.esc(A.url(imgs[0].replace(/^\//, ""))) + '" alt="' + A.esc(p.name) + '" id="mainImg">'
    : '<div class="ph" style="width:100%;height:100%" data-label="รูปสินค้าหลัก ' + A.esc(p.name) + '\nพื้นหลังขาว 1200×1200px"></div>';
  var thumbs = imgs.map(function (src, i) {
    return '<button data-i="' + i + '"' + (i === 0 ? ' class="is-active"' : "") +
      '><img src="' + A.esc(A.url(src.replace(/^\//, ""))) + '" alt=""></button>';
  }).join("");

  A.$("#crumbName").textContent = p.name;

  /* ---- ตัวเลือกแพ็ก (ราคาโปร 1/4/8/15 กล่อง) ---- */
  var packList = (p.packs && p.packs.length) ? p.packs : [{ qty: 1, price: p.price, image: imgs[0] }];
  var onePrice = packList[0].price;  /* ราคา 1 กล่อง ใช้คำนวณส่วนลด */
  var packsHtml = '<div class="packs" id="packs">' + packList.map(function (pk, i) {
    var per = Math.round(pk.price / pk.qty);
    var single = onePrice * pk.qty;
    var save = single - pk.price;
    return '<button type="button" class="pack' + (i === 0 ? " is-on" : "") + '" data-pack="' + pk.qty + '" data-price="' + pk.price + '">' +
      (pk.image ? '<img class="pack__img" src="' + A.esc(A.url(pk.image.replace(/^\//, ""))) + '" alt="">' : '<span class="pack__img"></span>') +
      '<span><span class="pack__name">' + (pk.qty > 1 ? "แพ็ก " + pk.qty + " กล่อง" : "1 กล่อง") + "</span>" +
        '<span class="pack__per">เฉลี่ย ฿' + A.baht(per) + " / กล่อง</span>" +
        (save > 0 ? '<span class="pack__save">ประหยัด ฿' + A.baht(save) + "</span>" : "") + "</span>" +
      '<span class="pack__price">' + (save > 0 ? "<small>฿" + A.baht(single) + "</small>" : "") + "฿" + A.baht(pk.price) + "</span>" +
      '<span class="pack__radio"></span></button>';
  }).join("") + "</div>";

  A.$("#pdp").innerHTML =
    "<div>" +
      '<div class="gallery__main">' + mainImg + "</div>" +
      '<div class="gallery__thumbs">' + thumbs + "</div>" +
      (imgs.length ? "" : '<p style="font-size:.82rem;color:var(--ink-faint);margin-top:12px">' +
        "📷 ต้องการรูป: รูปกล่องพื้นหลังขาว 1 รูป, รูปฉลากหลังอ่านออก 1 รูป, รูป lifestyle 2 รูป</p>") +
    "</div>" +
    "<div>" +
      '<span class="eyebrow">เลือกแพ็ก &amp; สั่งซื้อ</span>' +
      "<h2 style='margin:10px 0 4px;font-size:clamp(1.4rem,3vw,1.9rem)'>" + A.esc(p.name) + "</h2>" +
      "<p style='color:var(--ink-faint);font-size:.86rem;margin:2px 0 14px'>อย. " + A.esc(p.fda) + " · " + A.esc(p.unit) + " · เลือกแพ็กที่คุ้มที่สุด</p>" +
      packsHtml +
      '<div class="pdp__buy" style="margin-top:18px">' +
        '<div class="qty"><button id="qDec">−</button><input id="qVal" value="1" readonly aria-label="จำนวน"><button id="qInc">+</button></div>' +
        '<button class="btn btn--primary btn--lg" id="addBtn">ใส่ตะกร้า</button>' +
        '<a class="btn btn--line btn--lg" href="' + A.esc(S.site.contact.lineUrl) + '" target="_blank" rel="noopener">ถามก่อนซื้อ</a>' +
      "</div>" +
      '<div style="background:var(--sage-wash);border-radius:var(--r-md);padding:16px 18px;font-size:.9rem">' +
        "<b>🚚 " + (S.site.shipping.fee === 0 ? "ส่งฟรีทั่วไทย" : "ค่าส่ง ฿" + A.baht(S.site.shipping.fee)) + "</b><br>" +
        A.esc(S.site.shipping.carriers) + " · ส่งภายใน " + A.esc(S.site.shipping.leadTime) +
        (S.site.shipping.cod ? "<br>💵 เก็บเงินปลายทางได้" : "") +
        ((S.site.payment && S.site.payment.installment) ? " · 💳 ผ่อน 0% ได้" : "") +
      "</div>" +
    "</div>";

  /* แกลเลอรี */
  A.$$("#pdp .gallery__thumbs button").forEach(function (b) {
    b.addEventListener("click", function () {
      A.$$("#pdp .gallery__thumbs button").forEach(function (x) { x.classList.remove("is-active"); });
      b.classList.add("is-active");
      A.$("#mainImg").src = A.url(imgs[+b.dataset.i].replace(/^\//, ""));
    });
  });

  /* เลือกแพ็ก */
  var selPack = packList[0].qty;
  A.$$("#packs .pack").forEach(function (b) {
    b.addEventListener("click", function () {
      A.$$("#packs .pack").forEach(function (x) { x.classList.remove("is-on"); });
      b.classList.add("is-on");
      selPack = +b.dataset.pack;
    });
  });

  /* จำนวน + ใส่ตะกร้า */
  var qty = 1;
  A.$("#qInc").addEventListener("click", function () { qty++; A.$("#qVal").value = qty; });
  A.$("#qDec").addEventListener("click", function () { if (qty > 1) { qty--; A.$("#qVal").value = qty; } });
  A.$("#addBtn").addEventListener("click", function () { A.addToCart(p.slug, selPack, qty); });

  /* ---- เซลเพจ long-scroll (compliant) ---- */
  var onePrice = packList[0].price;
  var lineUrl = A.esc(S.site.contact.lineUrl);
  var biz = S.site.business || {};

  /* แบนเนอร์สินค้า (บนสุด) */
  var boxImg = imgs[0];
  var secHero =
    '<section class="pdp-hero"><div class="wrap pdp-hero__grid">' +
      '<div class="pdp-hero__text">' +
        '<span class="pdp__fda">✓ อย. ' + A.esc(p.fda) + "</span>" +
        "<h1>" + A.esc(p.name) + "</h1>" +
        "<p class='pdp-hero__tag'>" + A.esc(p.tagline) + "</p>" +
        ((p.benefits && p.benefits.length)
          ? '<ul class="card__benefits" style="margin:14px 0 22px">' + p.benefits.map(function (b) { return "<li>" + A.esc(b) + "</li>"; }).join("") + "</ul>"
          : "") +
        '<div class="pdp-hero__cta">' +
          '<button class="btn btn--primary btn--lg" id="heroBuy">🛒 ดูราคา &amp; สั่งซื้อ ↓</button>' +
          '<a class="btn btn--line btn--lg" href="' + lineUrl + '" target="_blank" rel="noopener">สอบถาม</a>' +
        "</div>" +
      "</div>" +
      '<div class="pdp-hero__media"><div class="hero-show">' +
        (boxImg ? '<img src="' + A.esc(A.url(boxImg.replace(/^\//, ""))) + '" alt="' + A.esc(p.name) + '">' : "") +
      "</div></div>" +
    "</div></section>";

  var secWho =
    '<section class="section pdp-sec pdp-sec--who"><div class="wrap">' +
      '<div class="sec-head"><span class="eyebrow">เหมาะกับใคร</span><h2>' + A.esc(p.name) + " เหมาะกับคุณไหม?</h2></div>" +
      '<div class="who-card"><div class="who-card__ico">🎯</div><div>' +
        "<p style='margin:0 0 12px'>" + A.esc(p.forWho) + "</p>" +
        '<a class="btn btn--ghost btn--sm" href="' + A.url("quiz.html") + '">ยังไม่แน่ใจ? ทำแบบประเมิน 1 นาที →</a>' +
      "</div></div></div></section>";

  var secHl = (p.highlights && p.highlights.length) ?
    '<section class="section pdp-sec"><div class="wrap">' +
      '<div class="sec-head"><span class="eyebrow">จุดเด่น</span><h2>ทำไมถึงเลือก ' + A.esc(p.name) + "</h2></div>" +
      '<div class="hl-grid">' + p.highlights.map(function (h, i) {
        return '<div class="hl-item reveal"><span class="hl-item__n">' + (i + 1) + "</span><p>" + A.esc(h) + "</p></div>";
      }).join("") + "</div></div></section>" : "";

  /* พื้นที่แบนเนอร์ภาพเซลเพจ (ใส่ภาพเต็มกว้างได้ไม่จำกัด) */
  var secBanners;
  if (p.banners && p.banners.length) {
    secBanners = '<section class="section pdp-sec"><div class="wrap"><div class="pdp-banners">' +
      p.banners.map(function (b) {
        var img = '<img src="' + A.esc(A.url(String(b.image || b).replace(/^\//, ""))) + '" alt="' + A.esc((b && b.alt) || p.name) + '" loading="lazy">';
        return (b && b.link) ? '<a href="' + A.esc(b.link) + '">' + img + "</a>" : img;
      }).join("") + "</div></div></section>";
  } else {
    var slots = [
      { t: "ภาพหัวเซลเพจ / ไลฟ์สไตล์", d: "ภาพสินค้าคู่ไลฟ์สไตล์ อารมณ์อบอุ่น (เลี่ยงคำเคลมโรค)" },
      { t: "อินโฟกราฟิกส่วนผสม / จุดเด่น", d: "อธิบายส่วนผสมสำคัญแบบภาพ เข้าใจง่าย" },
      { t: "ภาพรีวิว / ผลลัพธ์ผู้ใช้จริง", d: "แคปแชตหรือภาพรีวิว (เบลอชื่อ)" }
    ];
    secBanners = '<section class="section pdp-sec"><div class="wrap">' +
      '<div class="sec-head"><span class="eyebrow">พื้นที่ใส่ภาพเซลเพจ</span><h2>เพิ่มแบนเนอร์ภาพได้ที่นี่</h2>' +
        "<p>ทำภาพเต็มกว้าง (แนะนำกว้าง 1000px สูงได้ตามต้องการ) แล้วอัปโหลดในหลังบ้าน จะเรียงต่อกันแบบเซลเพจ</p></div>" +
      '<div class="pdp-banners">' + slots.map(function (s) {
        return '<div class="banner-ph"><b>🖼️ ' + A.esc(s.t) + "</b><span>" + A.esc(s.d) + "</span><small>กว้าง 1000px · .jpg/.png</small></div>";
      }).join("") + "</div></div></section>";
  }

  var secIng = (p.ingredients && p.ingredients.length) ?
    '<section class="section section--sand pdp-sec"><div class="wrap" style="max-width:760px">' +
      '<div class="sec-head"><span class="eyebrow">ส่วนประกอบสำคัญ</span><h2>ในทุกแคปซูล</h2>' +
        "<p>เราแสดงส่วนผสมและปริมาณจริงตามฉลาก ไม่มีปิดบัง</p></div>" +
      '<div class="scroll"><table class="spec"><tbody>' +
        p.ingredients.map(function (i) { return "<tr><th>" + A.esc(i.name) + "</th><td>" + A.esc(i.amount) + "</td></tr>"; }).join("") +
      "</tbody></table></div>" +
      "<p style='font-size:.85rem;color:var(--ink-faint);margin-top:14px;text-align:center'>ข้อมูลตามที่ระบุบนฉลากผลิตภัณฑ์ · ปริมาณต่อ 1 หน่วยบริโภค</p>" +
    "</div></section>" : "";

  var secHow =
    '<section class="section pdp-sec"><div class="wrap" style="max-width:720px">' +
      '<div class="sec-head"><span class="eyebrow">วิธีรับประทาน &amp; ข้อควรระวัง</span></div>' +
      '<div class="howto-card"><span style="font-size:1.6rem">💊</span><div><b>วิธีรับประทาน</b><br>' + A.esc(p.howto) + "</div></div>" +
      '<div class="warn-card"><b>⚠️ คำเตือน</b><p>' + A.esc(p.warning) + "</p></div>" +
      "<p style='font-size:.92rem'><b>ใครที่ไม่ควรรับประทาน:</b> <span style='color:var(--ink-soft)'>" + A.esc(p.notFor) + "</span></p>" +
    "</div></section>";

  var trust = [
    { i: "✅", t: "มีเลข อย.", d: p.fda },
    { i: "🏭", t: "ผลิตมาตรฐาน GMP", d: "โรงงานได้รับการรับรอง" },
    { i: "🪪", t: "ตัวแทนจำหน่ายแท้", d: "รหัส " + (biz.distributorId || "VIP0083") },
    { i: "🚚", t: "ส่งฟรี + ปลายทาง", d: "ผ่อน 0% ได้" }
  ];
  var secTrust =
    '<section class="section section--sage pdp-sec"><div class="wrap">' +
      '<div class="sec-head"><span class="eyebrow">ความมั่นใจ</span><h2>ตรวจสอบได้ทุกอย่าง</h2></div>' +
      '<div class="trust-grid">' + trust.map(function (t) {
        return '<div class="trust-item"><div class="trust-item__i">' + t.i + "</div><b>" + A.esc(t.t) + "</b><span>" + A.esc(t.d) + "</span></div>";
      }).join("") + "</div></div></section>";

  var secFaq = (p.faq && p.faq.length) ?
    '<section class="section pdp-sec"><div class="wrap" style="max-width:780px">' +
      '<div class="sec-head"><span class="eyebrow">คำถามที่พบบ่อย</span><h2>เรื่องที่ลูกค้าถามบ่อย</h2></div>' +
      '<div class="faq">' + p.faq.map(function (f) {
        return "<details><summary>" + A.esc(f.q) + "<span></span></summary><div class='faq__a'>" + A.esc(f.a) + "</div></details>";
      }).join("") + "</div></div></section>" : "";

  var secCta =
    '<section class="pdp-cta"><div class="wrap"><div class="pdp-cta__box">' +
      "<div><h2 style='margin:0 0 4px'>พร้อมเริ่มดูแลสุขภาพวันนี้</h2>" +
        "<p style='margin:0;opacity:.92'>🚚 ส่งฟรีทั่วไทย · 💵 เก็บเงินปลายทาง · 💳 ผ่อน 0% ได้</p></div>" +
      '<div class="pdp-cta__act">' +
        "<div class='pdp-cta__price'>เริ่มต้น ฿" + A.baht(onePrice) + " <small>/ กล่อง</small></div>" +
        '<button class="btn btn--lg" id="ctaAdd" style="background:#fff;color:var(--brand-dark)">🛒 สั่งซื้อเลย</button>' +
        '<a class="btn btn--line btn--lg" href="' + lineUrl + '" target="_blank" rel="noopener">ถามก่อนซื้อ</a>' +
      "</div>" +
    "</div></div></section>";

  var disc =
    '<div class="wrap"><p class="pdp-disc">' + A.esc(S.site.disclaimer) + "</p></div>";

  A.$("#pdpSections").innerHTML = secHero + secWho + secHl + secBanners + secIng + secHow + secTrust + secFaq + secCta + disc;

  A.$("#ctaAdd").addEventListener("click", function () {
    A.addToCart(p.slug, selPack, qty);
  });
  /* ปุ่มในแบนเนอร์ → เลื่อนไปส่วนซื้อ */
  A.$("#heroBuy").addEventListener("click", function () {
    var b = A.$("#pdp").closest("section");
    if (b) b.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ย้ายส่วนซื้อ (รูป + เลือกแพ็ก) ลงไปหลังโซน "ความมั่นใจ" — โครงเซลเพจ */
  var buySection = A.$("#pdp").closest("section");
  var trustSection = null;
  A.$$("#pdpSections section").forEach(function (sec) { if (sec.querySelector(".trust-grid")) trustSection = sec; });
  if (buySection && trustSection) {
    buySection.classList.add("section--sand");
    trustSection.after(buySection);
  }

  /* สินค้าอื่น */
  A.$("#related").innerHTML = S.products.filter(function (x) { return x.slug !== p.slug; })
    .slice(0, 4).map(A.productCard).join("");
  A.bindAddButtons();
  A.initReveal();
});
