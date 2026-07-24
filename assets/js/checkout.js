/* ============================================================
   checkout.js — หน้าสั่งซื้อ
   ส่งข้อมูลไปที่ /.netlify/functions/create-order
   ซึ่งจะคำนวณยอดใหม่ฝั่งเซิร์ฟเวอร์ แจ้งเข้า Lark และบันทึกลง Google Sheet
   ============================================================ */
document.addEventListener("site:ready", function (e) {
  var S = e.detail, A = window.App, s = S.site;
  var form = A.$("#coForm"), empty = A.$("#emptyCart");

  /* ---------- ตะกร้า ---------- */
  var cart = S.cart.map(function (i) {
    var p = S.products.filter(function (x) { return x.slug === i.slug; })[0];
    return p ? { slug: p.slug, name: p.name, price: p.price, qty: i.qty, images: p.images } : null;
  }).filter(Boolean);

  if (!cart.length) { empty.hidden = false; return; }
  form.hidden = false;

  var subtotal = cart.reduce(function (a, i) { return a + i.price * i.qty; }, 0);
  var shipFee  = (s.shipping.fee === 0 || subtotal >= s.shipping.freeOver) ? 0 : s.shipping.fee;
  var grand    = subtotal + shipFee;

  /* ---------- สรุปรายการ ---------- */
  A.$("#coLines").innerHTML = cart.map(function (i) {
    var img = (i.images && i.images[0])
      ? '<img src="' + A.esc(i.images[0]) + '" alt="">'
      : '<div class="ph" data-label=""></div>';
    return '<div class="co-line">' + img +
      "<div><b>" + A.esc(i.name) + "</b><span>฿" + A.baht(i.price) + " × " + i.qty + "</span></div>" +
      "<b>฿" + A.baht(i.price * i.qty) + "</b></div>";
  }).join("");

  A.$("#coTotals").innerHTML =
    "<div><span>ยอดรวมสินค้า</span><span>฿" + A.baht(subtotal) + "</span></div>" +
    "<div><span>ค่าจัดส่ง</span><span>" + (shipFee === 0
      ? "<b style='color:var(--sage-dark)'>ฟรี</b>" : "฿" + A.baht(shipFee)) + "</span></div>" +
    "<div class='co-grand'><span>ยอดที่ต้องชำระ</span><b>฿" + A.baht(grand) + "</b></div>";

  A.$("#coTrust").innerHTML =
    "<span>✓ ของแท้ 100%</span><span>✓ " + A.esc(s.shipping.leadTime) + "</span><span>✓ เปลี่ยน/คืนได้ 7 วัน</span>";
  A.$("#codTotal").textContent = "฿" + A.baht(grand);

  /* ---------- ข้อมูลบัญชีธนาคาร ---------- */
  A.$("#bankInfo").innerHTML = "<tbody>" +
    "<tr><th>ธนาคาร</th><td>" + A.esc(s.payment.bankName) + "</td></tr>" +
    "<tr><th>ชื่อบัญชี</th><td>" + A.esc(s.payment.bankAccountName) + "</td></tr>" +
    "<tr><th>เลขที่บัญชี</th><td><b style='font-family:monospace;font-size:1.05rem'>" +
      A.esc(s.payment.bankAccountNo) + "</b></td></tr>" +
    "<tr><th>ยอดที่ต้องโอน</th><td><b style='color:var(--brand-dark)'>฿" + A.baht(grand) + "</b></td></tr>" +
    "</tbody>";
  if (s.payment.promptpayQr) {
    A.$("#qrBox").innerHTML = '<img src="' + A.esc(s.payment.promptpayQr) +
      '" alt="QR พร้อมเพย์" style="max-width:220px;border-radius:var(--r-md);margin:10px 0">';
  }

  /* ---------- สลับวิธีชำระเงิน ---------- */
  var payMethod = "transfer";
  A.$$("#payOpts input[name=pay]").forEach(function (r) {
    r.addEventListener("change", function () {
      payMethod = r.value;
      A.$$(".pay-opt").forEach(function (l) { l.classList.toggle("is-on", l.contains(r) && r.checked); });
      A.$("#dTransfer").hidden = payMethod !== "transfer";
      A.$("#dCod").hidden      = payMethod !== "cod";
      A.$("#dCard").hidden     = payMethod !== "card";
      A.$("#submitBtn").textContent = payMethod === "card" ? "ไปหน้าชำระเงิน" : "ยืนยันคำสั่งซื้อ";
    });
  });

  /* ---------- แนบสลิป (ย่อรูปก่อนส่ง เพื่อไม่ให้ไฟล์ใหญ่เกิน) ---------- */
  var slipData = null;
  var drop = A.$("#slipDrop"), fileInput = A.$("#slipFile");

  function readSlip(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { showErr("ไฟล์สลิปต้องเป็นรูปภาพเท่านั้น"); return; }
    if (file.size > 5 * 1024 * 1024) { showErr("ไฟล์สลิปใหญ่เกิน 5 MB กรุณาย่อรูปก่อน"); return; }
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        /* ย่อด้านยาวสุดให้ไม่เกิน 1400px แล้วแปลงเป็น JPEG */
        var max = 1400, w = img.width, h = img.height;
        if (Math.max(w, h) > max) {
          var k = max / Math.max(w, h);
          w = Math.round(w * k); h = Math.round(h * k);
        }
        var cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        slipData = cv.toDataURL("image/jpeg", 0.85);
        A.$("#slipImg").src = slipData;
        A.$("#slipPreview").classList.add("is-on");
        drop.style.display = "none";
        hideErr();
      };
      img.onerror = function () { showErr("อ่านไฟล์รูปไม่สำเร็จ กรุณาลองไฟล์อื่น"); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  fileInput.addEventListener("change", function () { readSlip(fileInput.files[0]); });
  ["dragenter", "dragover"].forEach(function (ev) {
    drop.addEventListener(ev, function (x) { x.preventDefault(); drop.classList.add("is-over"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    drop.addEventListener(ev, function (x) { x.preventDefault(); drop.classList.remove("is-over"); });
  });
  drop.addEventListener("drop", function (x) {
    if (x.dataTransfer.files && x.dataTransfer.files[0]) readSlip(x.dataTransfer.files[0]);
  });
  A.$("#slipClear").addEventListener("click", function () {
    slipData = null; fileInput.value = "";
    A.$("#slipPreview").classList.remove("is-on");
    drop.style.display = "";
  });

  /* ---------- ตรวจสอบข้อมูล ---------- */
  function showErr(msg) {
    var box = A.$("#coErr");
    box.textContent = msg; box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function hideErr() { A.$("#coErr").hidden = true; }

  var RULES = [
    { id: "fName",     label: "ชื่อจริง",        test: function (v) { return v.length >= 2; } },
    { id: "fLast",     label: "นามสกุล",        test: function (v) { return v.length >= 2; } },
    { id: "fPhone",    label: "เบอร์โทรศัพท์",   test: function (v) { return v.replace(/\D/g, "").length >= 9; } },
    { id: "fAddr",     label: "ที่อยู่จัดส่ง",   test: function (v) { return v.length >= 10; } },
    { id: "fProvince", label: "จังหวัด",         test: function (v) { return v.length >= 2; } },
    { id: "fZip",      label: "รหัสไปรษณีย์",    test: function (v) { return /^\d{5}$/.test(v); } }
  ];

  function validate() {
    var bad = [];
    RULES.forEach(function (r) {
      var el = A.$("#" + r.id), v = el.value.trim();
      var ok = r.test(v);
      el.classList.toggle("field-err", !ok);
      if (!ok) bad.push(r.label);
    });
    var email = A.$("#fEmail");
    if (email.value.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) {
      email.classList.add("field-err"); bad.push("อีเมล");
    } else email.classList.remove("field-err");

    if (bad.length) { showErr("กรุณาตรวจสอบข้อมูลให้ครบถ้วน: " + bad.join(", ")); return false; }
    if (!A.$("#fAgree").checked) { showErr("กรุณายอมรับเงื่อนไขการสั่งซื้อก่อนดำเนินการต่อ"); return false; }
    hideErr();
    return true;
  }

  /* ---------- ส่งคำสั่งซื้อ ---------- */
  var busy = false;
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (busy || !validate()) return;

    var btn = A.$("#submitBtn");
    busy = true;
    btn.disabled = true;
    btn.textContent = "กำลังส่งคำสั่งซื้อ...";

    var payload = {
      customer: {
        firstName: A.$("#fName").value.trim(),
        lastName:  A.$("#fLast").value.trim(),
        phone:     A.$("#fPhone").value.trim(),
        email:     A.$("#fEmail").value.trim(),
        address:   A.$("#fAddr").value.trim(),
        province:  A.$("#fProvince").value.trim(),
        zip:       A.$("#fZip").value.trim(),
        note:      A.$("#fNote").value.trim()
      },
      items: cart.map(function (i) { return { slug: i.slug, qty: i.qty }; }),
      payment: payMethod,
      slip: payMethod === "transfer" ? slipData : null
    };

    fetch("/.netlify/functions/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () {
          throw new Error("เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (" + res.status + ")");
        });
      })
      .then(function (data) {
        if (!data.ok) throw new Error(data.error || "ส่งคำสั่งซื้อไม่สำเร็จ");

        localStorage.removeItem("ww_cart_v1");

        /* บัตรเครดิต — ส่งต่อไปหน้าชำระเงินของผู้ให้บริการ */
        if (data.redirect) {
          var f = document.createElement("form");
          f.method = data.redirect.method || "POST";
          f.action = data.redirect.url;
          Object.keys(data.redirect.fields || {}).forEach(function (k) {
            var inp = document.createElement("input");
            inp.type = "hidden"; inp.name = k; inp.value = data.redirect.fields[k];
            f.appendChild(inp);
          });
          document.body.appendChild(f);
          f.submit();
          return;
        }

        /* บัตรเครดิตแบบ Payment Link — ต้องแสดงยอดและเลขออเดอร์ให้ลูกค้ากรอกเอง */
        if (data.payLink) {
          sessionStorage.setItem("ww_paylink", JSON.stringify(data.payLink));
          location.href = "thankyou.html?no=" + encodeURIComponent(data.orderNo) + "&pay=card&mode=link";
          return;
        }

        location.href = "thankyou.html?no=" + encodeURIComponent(data.orderNo) +
          "&pay=" + encodeURIComponent(payMethod) +
          (data.warning ? "&warn=" + encodeURIComponent(data.warning) : "");
      })
      .catch(function (err) {
        busy = false;
        btn.disabled = false;
        btn.textContent = payMethod === "card" ? "ไปหน้าชำระเงิน" : "ยืนยันคำสั่งซื้อ";
        showErr(
          err.message.indexOf("Failed to fetch") > -1 || err.message.indexOf("404") > -1
            ? "ยังเชื่อมต่อระบบสั่งซื้อไม่ได้ — ระบบนี้ทำงานเมื่อเว็บขึ้นออนไลน์บน Netlify แล้วเท่านั้น " +
              "ระหว่างนี้รบกวนสั่งซื้อทาง LINE ได้เลยครับ"
            : err.message
        );
      });
  });
});
