/* ============================================================
   app.js — แกนกลางของเว็บ
   โหลดเนื้อหาจาก /content/*.json (แก้ได้จากหลังบ้าน /admin)
   จัดการ: header, footer, ตะกร้าสินค้า, ส่งออเดอร์เข้า LINE
   ============================================================ */
(function () {
  "use strict";

  const CART_KEY = "ww_cart_v1";
  const ORDERS_KEY = "ww_myorders_v1";
  const state = { site: null, products: [], articles: [], reviews: [], cart: [] };
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------- utils ---------- */
  const baht = (n) => Number(n || 0).toLocaleString("th-TH");
  const esc  = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /* ไฟล์ HTML ในโฟลเดอร์ /p/ ต้องถอยขึ้นหนึ่งระดับ */
  const BASE = location.pathname.includes("/p/") ? "../" : "";
  const url  = (p) => BASE + p;

  async function loadJSON(path) {
    const res = await fetch(url(path), { cache: "no-store" });
    if (!res.ok) throw new Error("โหลด " + path + " ไม่สำเร็จ (" + res.status + ")");
    return res.json();
  }

  /* ---------- ไอคอน ---------- */
  const ICONS = {
    shield: '<path d="M12 3l7 3v6c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V6l7-3z"/>',
    label:  '<path d="M4 6h16M4 12h10M4 18h7"/>',
    chat:   '<path d="M21 12a8 8 0 1 1-3.2-6.4L21 4l-1 4.2A7.9 7.9 0 0 1 21 12z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
    truck:  '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/>',
    cart:   '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12h11l2-8H6"/>',
    phone:  '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/>',
    menu:   '<path d="M3 6h18M3 12h18M3 18h18"/>',
    close:  '<path d="M18 6L6 18M6 6l12 12"/>'
  };
  /* กล่องโลโก้ — ใช้รูปจริงถ้ามี ไม่งั้นใช้ตัวอักษรในกล่องไล่สี */
  function brandMark() {
    const s = state.site;
    return s.brand.logo
      ? '<span class="logo__mark logo__mark--img"><img src="' + esc(url(s.brand.logo)) + '" alt="' + esc(s.brand.name) + '"></span>'
      : '<span class="logo__mark">' + esc(s.brand.logoText || "R") + "</span>";
  }

  const icon = (n, size) => '<svg width="' + (size || 22) + '" height="' + (size || 22) +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    (ICONS[n] || "") + "</svg>";

  /* รูปสินค้า: ใช้รูปจริงถ้ามี ไม่งั้นแสดง placeholder */
  function productImg(p, cls) {
    const src = (p.images && p.images[0]) || "";
    if (src) return '<img src="' + esc(url(src.replace(/^\//, ""))) + '" alt="' + esc(p.name) + '" loading="lazy">';
    return '<div class="ph" style="width:100%;height:100%" data-label="รูป ' + esc(p.name) + '"></div>';
  }

  /* ---------- Header ---------- */
  /* โครงเมนู: แก้ตรงนี้ที่เดียว มีผลทั้งเมนูบนจอใหญ่และเมนูมือถือ */
  const NAV = [
    { href: "index.html", label: "หน้าแรก", ico: "🏠" },
    { label: "สินค้า", ico: "🛍️", sub: [
      { href: "shop.html",    ico: "🧴", label: "สินค้าทั้งหมด",     desc: "ดูครบทุกรายการพร้อมราคา" },
      { href: "compare.html", ico: "⚖️", label: "เปรียบเทียบสินค้า", desc: "เทียบทุกตัวในตารางเดียว" },
      { href: "quiz.html",    ico: "🧭", label: "ตัวไหนเหมาะกับคุณ", desc: "ตอบ 5 ข้อ ใช้เวลา 1 นาที" }
    ] },
    { href: "articles.html", label: "บทความ", ico: "📖" },
    { href: "about.html",    label: "เกี่ยวกับเรา", ico: "🤝" },
    { href: "contact.html",  label: "ติดต่อ", ico: "💬" }
  ];

  function renderHeader() {
    const s = state.site, host = $("#site-header");
    if (!host) return;
    const page = location.pathname.split("/").pop() || "index.html";
    const on = (h) => (page === h ? ' class="is-active"' : "");
    const caret = '<svg class="nav__caret" width="12" height="12" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

    /* เมนูจอใหญ่ */
    const navHtml = "<ul>" + NAV.map((l) => {
      if (!l.sub) return "<li><a href=" + JSON.stringify(url(l.href)) + on(l.href) + ">" + l.label + "</a></li>";
      const active = l.sub.some((x) => x.href === page);
      return "<li><span class='nav__btn'" + (active ? " style='color:var(--ink);font-weight:600'" : "") + ">" +
        l.label + caret + "</span>" +
        '<div class="nav__sub">' + l.sub.map((x) =>
          "<a href=" + JSON.stringify(url(x.href)) + "><i>" + x.ico + "</i><span><b>" + x.label +
          "</b><small>" + x.desc + "</small></span></a>").join("") + "</div></li>";
    }).join("") + "</ul>";

    /* เมนูมือถือ */
    const mnavHtml = NAV.map((l) => {
      if (!l.sub) return "<a href=" + JSON.stringify(url(l.href)) + on(l.href) + "><i>" + l.ico + "</i>" + l.label + "</a>";
      return '<div class="mnav__group">' + l.label + "</div>" + l.sub.map((x) =>
        "<a href=" + JSON.stringify(url(x.href)) + on(x.href) + "><i>" + x.ico + "</i><span>" + x.label +
        "<small>" + x.desc + "</small></span></a>").join("");
    }).join("");

    /* แถบบนสุด — ถ้าใส่ items จะแสดงเป็นรายการมีไอคอนคั่น ถ้าไม่ใส่จะใช้ text ธรรมดา */
    const PROMO_ICON = ["🚚", "💵", "💳", "🎁", "⭐"];
    let promoInner;
    if (s.promo && s.promo.active && s.promo.items && s.promo.items.length) {
      promoInner = '<ul class="topbar__list">' + s.promo.items.map((t, i) =>
        "<li><i>" + PROMO_ICON[i % PROMO_ICON.length] + "</i>" + esc(t) + "</li>").join("") + "</ul>";
    } else if (s.promo && s.promo.active) {
      promoInner = "<span>" + esc(s.promo.text) + "</span>";
    } else {
      promoInner = "<span>✓ ตัวแทนจำหน่ายอย่างเป็นทางการ · สินค้าตรงปก มีเลข อย. ทุกรายการ</span>";
    }
    const promo = '<div class="topbar__promo">' + promoInner +
      (s.promo && s.promo.active && s.promo.link
        ? '<a href="' + esc(url(s.promo.link)) + '">' + esc(s.promo.linkText) + " →</a>" : "") + "</div>";

    host.innerHTML =
      '<div class="topbar" id="topbar"><div class="wrap topbar__in">' + promo +
        '<div class="topbar__links">' +
          '<a href="' + url("order.html") + '">📦 เช็คสถานะออเดอร์</a>' +
          '<span class="topbar__sep"></span>' +
          '<a href="tel:' + esc(s.contact.phoneRaw) + '">' + icon("phone", 14) + " " + esc(s.contact.phone) + "</a>" +
          '<button class="topbar__close" id="topbarClose" aria-label="ปิดแถบนี้">✕</button>' +
        "</div>" +
      "</div></div>" +

      '<header class="header" id="header"><div class="wrap header__bar">' +
        '<a class="logo" href="' + url("index.html") + '">' + brandMark() +
          '<span class="logo__txt">' + esc(s.brand.name) +
            '<span class="logo__sub">' + esc(s.brand.subtitle || "") + "</span>" +
          "</span>" +
        "</a>" +
        '<nav class="nav" aria-label="เมนูหลัก">' + navHtml + "</nav>" +
        '<div class="header__actions">' +
          '<a class="btn btn--line btn--sm hide-mobile" href="' + esc(s.contact.lineUrl) + '" target="_blank" rel="noopener">💬 ปรึกษาฟรี</a>' +
          '<button class="cart-btn" id="cartOpen" aria-label="ตะกร้าสินค้า">' + icon("cart", 20) +
            '<span class="cart-btn__count" id="cartCount" hidden>0</span></button>' +
          '<button class="burger" id="burger" aria-label="เปิดเมนู" aria-expanded="false">' + icon("menu") + "</button>" +
        "</div>" +
      "</div></header>" +

      '<div class="mnav" id="mnav">' + mnavHtml +
        '<div class="mnav__foot">' +
          '<a class="btn btn--line btn--block btn--lg" href="' + esc(s.contact.lineUrl) + '" target="_blank" rel="noopener">💬 ปรึกษาฟรีทาง LINE</a>' +
          '<a class="btn btn--ghost btn--block" href="' + url("order.html") + '">📦 เช็คสถานะออเดอร์</a>' +
          '<a class="btn btn--ghost btn--block" href="tel:' + esc(s.contact.phoneRaw) + '">โทร ' + esc(s.contact.phone) + "</a>" +
        "</div>" +
      "</div>";

    /* ปุ่มแฮมเบอร์เกอร์ — วางแผงเมนูให้ชิดใต้แถบหลักพอดี */
    const burger = $("#burger"), mnav = $("#mnav"), header = $("#header");
    burger.addEventListener("click", () => {
      const open = !mnav.classList.contains("is-open");
      mnav.style.top = header.getBoundingClientRect().bottom + "px";
      mnav.classList.toggle("is-open", open);
      burger.innerHTML = icon(open ? "close" : "menu");
      burger.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    });

    /* ปิดแถบโปรโมชั่น (จำไว้ตลอด session) */
    const tb = $("#topbar");
    if (sessionStorage.getItem("ww_topbar_off")) tb.style.display = "none";
    $("#topbarClose").addEventListener("click", () => {
      tb.style.display = "none";
      sessionStorage.setItem("ww_topbar_off", "1");
    });

    /* เงาใต้แถบ + ย่อความสูง เมื่อเลื่อนลง
       ใช้ตัวตรวจจับ (sentinel) แทน scroll event — ลื่นกว่าและไม่กินแรงเครื่อง */
    const sentinel = document.createElement("div");
    sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none";
    document.body.prepend(sentinel);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        (en) => header.classList.toggle("is-stuck", !en[0].isIntersecting),
        { threshold: 0 }
      ).observe(sentinel);
    } else {
      window.addEventListener("scroll", () => {
        header.classList.toggle("is-stuck", window.scrollY > 8);
      }, { passive: true });
    }

    $("#cartOpen").addEventListener("click", openCart);
  }

  /* ---------- Footer + แถบล่างมือถือ ---------- */
  function renderFooter() {
    const s = state.site, host = $("#site-footer");
    if (!host) return;
    const prodLinks = state.products.map((p) =>
      '<li><a href="' + url("p/" + p.slug + ".html") + '">' + esc(p.name) + "</a></li>").join("");

    host.innerHTML =
      '<footer class="footer"><div class="wrap">' +
        '<div class="footer__grid">' +
          "<div>" +
            '<div class="logo" style="color:#fff;margin-bottom:14px">' +
              brandMark() + "<span>" + esc(s.brand.name) + "</span></div>" +
            '<p style="font-size:.9rem;color:#B7ABA0;max-width:32ch">' + esc(s.brand.tagline) + "</p>" +
            '<p style="font-size:.86rem;color:#9C9086">' + esc(s.business.legalName) + "<br>เลขประจำตัวผู้เสียภาษี " + esc(s.business.taxId) + "</p>" +
          "</div>" +
          "<div><h4>สินค้า</h4><ul>" + prodLinks + "</ul></div>" +
          '<div><h4>ข้อมูล</h4><ul>' +
            '<li><a href="' + url("about.html") + '">เกี่ยวกับเรา</a></li>' +
            '<li><a href="' + url("order.html") + '">เช็คสถานะออเดอร์</a></li>' +
            '<li><a href="' + url("consult.html") + '">นัดปรึกษาผู้เชี่ยวชาญ</a></li>' +
            '<li><a href="' + url("articles.html") + '">บทความสุขภาพ</a></li>' +
            '<li><a href="' + url("compare.html") + '">เปรียบเทียบสินค้า</a></li>' +
            '<li><a href="' + url("policy.html") + '">การจัดส่ง &amp; การคืนสินค้า</a></li>' +
            '<li><a href="' + url("policy.html") + '#privacy">นโยบายความเป็นส่วนตัว</a></li>' +
          "</ul></div>" +
          "<div><h4>ติดต่อเรา</h4><ul>" +
            '<li>โทร <a href="tel:' + esc(s.contact.phoneRaw) + '">' + esc(s.contact.phone) + "</a></li>" +
            '<li>LINE <a href="' + esc(s.contact.lineUrl) + '" target="_blank" rel="noopener">' + esc(s.contact.lineId) + "</a></li>" +
            "<li>" + esc(s.contact.openHours) + "</li>" +
            '<li style="color:#9C9086;white-space:pre-line">' + esc(s.contact.address) + "</li>" +
          "</ul></div>" +
        "</div>" +
        '<div class="disclaimer">' + esc(s.disclaimer) + "</div>" +
        '<div class="footer__bottom"><span>© ' + new Date().getFullYear() + " " + esc(s.brand.name) + " สงวนลิขสิทธิ์</span>" +
          "<span>ผลิตภัณฑ์ทุกรายการมีเลขสารบบอาหาร (อย.) ถูกต้อง</span></div>" +
      "</div></footer>" +
      /* แถบปุ่มลอย — แสดงเฉพาะหน้าเซลเพจสินค้า (/p/) */
      (location.pathname.indexOf("/p/") > -1
        ? '<div class="mobile-bar">' +
            '<a class="btn btn--line" href="' + esc(s.contact.lineUrl) + '" target="_blank" rel="noopener">สอบถาม</a>' +
            '<a class="btn btn--red" href="tel:' + esc(s.contact.phoneRaw) + '">' + icon("phone", 17) + " โทร</a>" +
            '<a class="btn btn--primary" href="#pdp">' + icon("cart", 17) + " สั่งซื้อ</a>" +
          "</div>"
        : "");
    if (location.pathname.indexOf("/p/") > -1) document.body.classList.add("has-mobilebar");
  }

  /* ---------- Cart ---------- */
  function loadCart() {
    try { state.cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (e) { state.cart = []; }
  }
  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    updateCartCount();
    renderCart();
  }
  function updateCartCount() {
    const el = $("#cartCount");
    if (!el) return;
    const n = state.cart.reduce((a, i) => a + i.qty, 0);
    el.textContent = n;
    el.hidden = n === 0;
  }
  /* ราคาต่อ 1 แพ็ก (pack = จำนวนกล่องในแพ็ก เช่น 1/4/8/15) */
  function packPrice(p, pack) {
    pack = pack || 1;
    if (p.packs) {
      const found = p.packs.find((x) => Number(x.qty) === Number(pack));
      if (found) return found.price;
    }
    return p.price * pack;
  }
  function packLabel(pack) { return (pack > 1) ? "แพ็ก " + pack + " กล่อง" : "1 กล่อง"; }

  /* addToCart(slug, pack, qty) — pack = ขนาดแพ็ก, qty = จำนวนแพ็ก */
  function addToCart(slug, pack, qty) {
    const p = state.products.find((x) => x.slug === slug);
    if (!p) return;
    pack = pack || 1; qty = qty || 1;
    const line = state.cart.find((i) => i.slug === slug && (i.pack || 1) === pack);
    if (line) line.qty += qty;
    else state.cart.push({ slug: slug, pack: pack, qty: qty });
    saveCart();
    toast(p.name + " (" + packLabel(pack) + ") เพิ่มลงตะกร้าแล้ว");
    openCart();
  }
  function cartTotal() {
    return state.cart.reduce((sum, i) => {
      const p = state.products.find((x) => x.slug === i.slug);
      return sum + (p ? packPrice(p, i.pack || 1) * i.qty : 0);
    }, 0);
  }

  function ensureDrawer() {
    if ($("#drawer")) return;
    const el = document.createElement("div");
    el.innerHTML =
      '<div class="drawer-backdrop" id="drawerBd"></div>' +
      '<aside class="drawer" id="drawer" aria-label="ตะกร้าสินค้า">' +
        '<div class="drawer__head"><h3>ตะกร้าของคุณ</h3>' +
          '<button id="drawerClose" aria-label="ปิด">' + icon("close", 20) + "</button></div>" +
        '<div class="drawer__body" id="drawerBody"></div>' +
        '<div class="drawer__foot" id="drawerFoot"></div>' +
      "</aside>";
    document.body.appendChild(el);
    $("#drawerBd").addEventListener("click", closeCart);
    $("#drawerClose").addEventListener("click", closeCart);
  }
  function openCart()  { ensureDrawer(); renderCart(); $("#drawer").classList.add("is-open"); $("#drawerBd").classList.add("is-open"); }
  function closeCart() { const d = $("#drawer"); if (d) { d.classList.remove("is-open"); $("#drawerBd").classList.remove("is-open"); } }

  function renderCart() {
    const body = $("#drawerBody"), foot = $("#drawerFoot");
    if (!body) return;
    if (!state.cart.length) {
      body.innerHTML = '<div class="cart-empty"><p>ยังไม่มีสินค้าในตะกร้า</p>' +
        '<a class="btn btn--primary" href="' + url("shop.html") + '">เลือกสินค้า</a></div>';
      foot.innerHTML = "";
      return;
    }
    body.innerHTML = state.cart.map((i) => {
      const p = state.products.find((x) => x.slug === i.slug);
      if (!p) return "";
      const pack = i.pack || 1;
      const pk = (p.packs || []).find((x) => Number(x.qty) === Number(pack));
      const imgSrc = (pk && pk.image) || (p.images && p.images[0]);
      const img = imgSrc
        ? '<img class="cart-line__img" src="' + esc(url(imgSrc.replace(/^\//, ""))) + '" alt="">'
        : '<div class="cart-line__img ph" data-label=""></div>';
      const key = esc(p.slug) + '" data-pack="' + pack;
      return '<div class="cart-line">' + img +
        '<div><div class="cart-line__name">' + esc(p.name) + '</div>' +
          '<div class="cart-line__meta">' + esc(packLabel(pack)) + " · ฿" + baht(packPrice(p, pack)) + " × " + i.qty + "</div>" +
          '<button class="cart-line__rm" data-rm="' + key + '">ลบออก</button></div>' +
        '<div class="qty"><button data-dec="' + key + '">−</button>' +
          '<input value="' + i.qty + '" readonly aria-label="จำนวน">' +
          '<button data-inc="' + key + '">+</button></div>' +
      "</div>";
    }).join("");

    const total = cartTotal();
    const ship  = state.site.shipping;
    const pay   = state.site.payment || {};
    const free  = ship.fee === 0 || total >= ship.freeOver;
    const shipNote = ship.fee === 0
      ? "🚚 ส่งฟรีทั่วไทย ทุกยอดสั่งซื้อ"
      : (free ? "🎉 ยอดนี้ได้ส่งฟรีแล้ว"
              : "ค่าจัดส่ง ฿" + baht(ship.fee) + " · ซื้อเพิ่มอีก ฿" + baht(ship.freeOver - total) + " ส่งฟรี");
    foot.innerHTML =
      '<div class="cart-total"><span>ยอดรวมสินค้า</span><b>฿' + baht(total) + "</b></div>" +
      '<p style="font-size:.85rem;color:var(--ink-soft);margin:-6px 0 6px">' + shipNote + "</p>" +
      '<p style="font-size:.85rem;color:var(--ink-soft);margin:0 0 14px">' +
        (ship.cod ? "💵 เก็บเงินปลายทางได้" : "") +
        (pay.installment ? (ship.cod ? " · " : "") + "💳 ผ่อน 0% ได้" : "") + "</p>" +
      '<a class="btn btn--primary btn--block btn--lg" href="' + url("checkout.html") + '">สั่งซื้อสินค้า</a>' +
      '<button class="btn btn--ghost btn--block" id="checkoutLine" style="margin-top:10px">หรือสั่งผ่าน LINE</button>' +
      '<p style="font-size:.78rem;color:var(--ink-faint);text-align:center;margin:10px 0 0">' +
        "🔒 โอนเงิน · เก็บเงินปลายทาง · บัตรเครดิต</p>";

    $$("[data-inc]", foot.parentElement).forEach((b) => b.addEventListener("click", () => changeQty(b.dataset.inc, +b.dataset.pack, 1)));
    $$("[data-dec]", foot.parentElement).forEach((b) => b.addEventListener("click", () => changeQty(b.dataset.dec, +b.dataset.pack, -1)));
    $$("[data-rm]",  foot.parentElement).forEach((b) => b.addEventListener("click", () => removeLine(b.dataset.rm, +b.dataset.pack)));
    $("#checkoutLine").addEventListener("click", checkoutLine);
  }
  function changeQty(slug, pack, d) {
    pack = pack || 1;
    const line = state.cart.find((i) => i.slug === slug && (i.pack || 1) === pack);
    if (!line) return;
    line.qty += d;
    if (line.qty < 1) return removeLine(slug, pack);
    saveCart();
  }
  function removeLine(slug, pack) {
    pack = pack || 1;
    state.cart = state.cart.filter((i) => !(i.slug === slug && (i.pack || 1) === pack));
    saveCart();
  }

  /* ---------- ออเดอร์ของฉัน (เก็บในเครื่องลูกค้าเท่านั้น) ---------- */
  function myOrders() {
    try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; }
    catch (e) { return []; }
  }
  function rememberOrder(rec) {
    const list = myOrders();
    list.unshift(rec);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(list.slice(0, 10)));
  }
  /* เลขอ้างอิงชั่วคราว รูปแบบ HW-YYMMDD-XXX (ทีมงานยืนยันเลขจริงอีกครั้งทาง LINE) */
  function makeRef() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const seq = String(Math.floor(Math.random() * 900) + 100);
    return "HW-" + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + "-" + seq;
  }

  /* ส่งออเดอร์เข้า LINE — สร้างข้อความสรุปแล้วเปิดแชท */
  function checkoutLine() {
    const s = state.site, total = cartTotal();
    const free = s.shipping.fee === 0 || total >= s.shipping.freeOver;
    const ship = free ? 0 : s.shipping.fee;
    const ref = makeRef();
    const lines = state.cart.map((i) => {
      const p = state.products.find((x) => x.slug === i.slug);
      const pack = i.pack || 1;
      return "• " + p.name + " (" + packLabel(pack) + ") × " + i.qty + "  = ฿" + baht(packPrice(p, pack) * i.qty);
    }).join("\n");
    const msg =
      "สวัสดีครับ/ค่ะ ต้องการสั่งซื้อสินค้าตามนี้\n" +
      "เลขอ้างอิง: " + ref + "\n\n" + lines +
      "\n\nค่าสินค้า ฿" + baht(total) +
      "\nค่าจัดส่ง " + (free ? "ฟรี" : "฿" + baht(ship)) +
      "\nยอดรวม ฿" + baht(total + ship) +
      "\n\nรบกวนแจ้งวิธีชำระเงินด้วยครับ/ค่ะ";

    rememberOrder({
      ref: ref,
      date: new Date().toISOString().slice(0, 10),
      items: state.cart.map((i) => {
        const p = state.products.find((x) => x.slug === i.slug);
        return p.name + " (" + packLabel(i.pack || 1) + ") × " + i.qty;
      }).join(", "),
      total: total + ship
    });
    /* คัดลอกข้อความไว้ให้ด้วย เผื่อ LINE ไม่รับ prefill */
    try { navigator.clipboard.writeText(msg); } catch (e) {}
    const target = s.contact.lineUrl + (s.contact.lineUrl.indexOf("?") > -1 ? "&" : "?") +
      "text=" + encodeURIComponent(msg);
    toast("คัดลอกรายการแล้ว — กำลังเปิด LINE");
    window.open(target, "_blank", "noopener");
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(text) {
    let el = $("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast"; el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = text;
    requestAnimationFrame(() => el.classList.add("is-open"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-open"), 2600);
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    const els = $$(".reveal");
    if (!els.length || !("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });
    els.forEach((e) => io.observe(e));
    /* กันเนื้อหาค้างซ่อน: ถ้า IO ไม่ทริกเกอร์ ให้โชว์ทั้งหมดหลัง 2.5 วิ */
    setTimeout(() => els.forEach((e) => e.classList.add("is-in")), 2500);
  }

  /* ---------- Product card ---------- */
  function productCard(p) {
    const badge = p.badge
      ? '<span class="card__tag' + (p.badgeStyle === "sage" ? " card__tag--sage" : "") + '">' + esc(p.badge) + "</span>"
      : "";
    const was = p.priceWas && p.priceWas > p.price
      ? '<span class="price__was">฿' + baht(p.priceWas) + "</span>" : "";
    const benefits = (p.benefits && p.benefits.length)
      ? '<ul class="card__benefits">' + p.benefits.map((b) => "<li>" + esc(b) + "</li>").join("") + "</ul>"
      : '<p class="card__desc">' + esc(p.short) + "</p>";
    return '<article class="card reveal">' +
      '<a class="card__media" href="' + url("p/" + p.slug + ".html") + '">' + badge + productImg(p) + "</a>" +
      '<div class="card__body">' +
        '<h3 class="card__name"><a href="' + url("p/" + p.slug + ".html") + '">' + esc(p.name) + "</a></h3>" +
        '<p class="card__fda">อย. ' + esc(p.fda) + " · " + esc(p.unit) + "</p>" +
        benefits +
        '<div class="card__foot">' +
          '<div class="price">' + was + '฿' + baht(p.price) + ' <small>/ กล่อง</small></div>' +
          '<button class="btn btn--primary btn--sm" data-add="' + esc(p.slug) + '">ใส่ตะกร้า</button>' +
        "</div>" +
      "</div></article>";
  }
  function bindAddButtons(root) {
    $$("[data-add]", root || document).forEach((b) => {
      if (b.dataset.bound) return;
      b.dataset.bound = "1";
      b.addEventListener("click", () => addToCart(b.dataset.add, +(b.dataset.pack || 1), 1));
    });
  }

  /* ---------- Boot ---------- */
  async function init() {
    const [site, prod, arts, revs] = await Promise.all([
      loadJSON("content/site.json"),
      loadJSON("content/products.json"),
      loadJSON("content/articles.json").catch(() => ({ articles: [] })),
      loadJSON("content/reviews.json").catch(() => ({ reviews: [] }))
    ]);
    state.site = site;
    state.products = (prod.products || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    state.bundles = prod.bundles || [];
    state.articles = arts.articles || [];
    state.reviews = revs.reviews || [];

    document.title = document.title.replace("{{brand}}", site.brand.name);
    loadCart();
    renderHeader();
    renderFooter();
    ensureDrawer();
    updateCartCount();

    document.dispatchEvent(new CustomEvent("site:ready", { detail: state }));
    initReveal();
    bindAddButtons();
  }

  /* export */
  window.App = {
    state: state, init: init, $: $, $$: $$, baht: baht, esc: esc, url: url, icon: icon,
    productCard: productCard, productImg: productImg, bindAddButtons: bindAddButtons,
    addToCart: addToCart, openCart: openCart, toast: toast, initReveal: initReveal,
    myOrders: myOrders, loadJSON: loadJSON, packPrice: packPrice, packLabel: packLabel
  };

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      console.error(err);
      const m = document.createElement("div");
      m.style.cssText = "padding:40px;text-align:center;font-family:sans-serif";
      m.innerHTML = "<h2>โหลดเนื้อหาไม่สำเร็จ</h2><p>" + esc(err.message) +
        "</p><p style='color:#888;font-size:.9rem'>หมายเหตุ: เว็บนี้ต้องเปิดผ่านเซิร์ฟเวอร์ (http://) ไม่ใช่ดับเบิลคลิกไฟล์โดยตรง</p>";
      document.body.prepend(m);
    });
  });
})();
