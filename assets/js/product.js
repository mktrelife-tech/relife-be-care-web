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
      '<span class="pdp__fda">✓ อย. ' + A.esc(p.fda) + "</span>" +
      "<h1 style='margin:14px 0 4px;font-size:clamp(1.7rem,3.6vw,2.4rem)'>" + A.esc(p.name) + "</h1>" +
      "<p style='color:var(--ink-soft);font-size:1.03rem'>" + A.esc(p.tagline) + "</p>" +
      "<p style='color:var(--ink-faint);font-size:.86rem;margin:2px 0 10px'>" + A.esc(p.unit) + " · เลือกแพ็กที่คุ้มที่สุด</p>" +
      packsHtml +
      "<ul style='list-style:none;padding:0;display:grid;gap:9px;margin:18px 0 22px'>" +
        (p.highlights || []).map(function (h) {
          return "<li style='display:flex;gap:10px'><span style='color:var(--sage-dark);font-weight:700'>✓</span><span>" + A.esc(h) + "</span></li>";
        }).join("") + "</ul>" +
      '<div class="pdp__buy">' +
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

  /* ---- แท็บข้อมูล ---- */
  A.$("#tabPanels").innerHTML =
    '<div class="tab-panel" id="tab-detail">' +
      "<p>" + A.esc(p.short) + "</p>" +
      "<h3>เหมาะกับใคร</h3><p>" + A.esc(p.forWho) + "</p>" +
      "<h3>ใครที่ไม่ควรรับประทาน</h3><p>" + A.esc(p.notFor) + "</p>" +
    "</div>" +
    '<div class="tab-panel" id="tab-ingredients" hidden>' +
      "<table class='spec'><tbody>" +
        (p.ingredients || []).map(function (i) {
          return "<tr><th>" + A.esc(i.name) + "</th><td>" + A.esc(i.amount) + "</td></tr>";
        }).join("") +
      "</tbody></table>" +
      "<p style='font-size:.85rem;color:var(--ink-faint);margin-top:14px'>ข้อมูลตามที่ระบุบนฉลากผลิตภัณฑ์ · ปริมาณต่อ 1 หน่วยบริโภค</p>" +
    "</div>" +
    '<div class="tab-panel" id="tab-howto" hidden>' +
      "<h3>วิธีรับประทาน</h3><p>" + A.esc(p.howto) + "</p>" +
      "<h3>คำเตือน</h3><p style='color:var(--ink-soft)'>" + A.esc(p.warning) + "</p>" +
    "</div>" +
    '<div class="tab-panel" id="tab-faq" hidden><div class="faq" style="margin:0">' +
      ((p.faq && p.faq.length) ? p.faq.map(function (f) {
        return "<details><summary>" + A.esc(f.q) + "<span></span></summary><div class='faq__a'>" + A.esc(f.a) + "</div></details>";
      }).join("") : "<p style='color:var(--ink-faint)'>[[ เพิ่มคำถามที่ลูกค้าถามบ่อยของสินค้านี้ได้ในหลังบ้าน ]]</p>") +
    "</div></div>";

  A.$$("#tabs button").forEach(function (b) {
    b.addEventListener("click", function () {
      A.$$("#tabs button").forEach(function (x) { x.classList.remove("is-active"); });
      b.classList.add("is-active");
      A.$$("#tabPanels .tab-panel").forEach(function (pn) { pn.hidden = true; });
      A.$("#tab-" + b.dataset.tab).hidden = false;
    });
  });

  /* สินค้าอื่น */
  A.$("#related").innerHTML = S.products.filter(function (x) { return x.slug !== p.slug; })
    .slice(0, 4).map(A.productCard).join("");
  A.bindAddButtons();
  A.initReveal();
});
