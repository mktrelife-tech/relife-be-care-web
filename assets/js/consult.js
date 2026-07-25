/* ============================================================
   consult.js — วิซาร์ดนัดปรึกษา 3 ขั้น (เก็บฟีลจองนัด แต่กรอกน้อย)
   ส่งเข้า /.netlify หรือ /api/create-consult (แจ้ง Lark) + fallback LINE
   ============================================================ */
document.addEventListener("site:ready", function (e) {
  var S = e.detail, A = window.App, s = S.site;
  var stepper = A.$("#stepper"), card = A.$("#wzCard");

  var STEPS = ["เลือกเรื่อง", "ข้อมูลติดต่อ", "เสร็จสิ้น"];
  var TOPICS = [
    { v: "หาสินค้าที่เหมาะกับฉัน/คนที่บ้าน", d: "ไม่รู้จะเริ่มตัวไหน ให้เราช่วยแนะนำ" },
    { v: "สอบถามส่วนผสม / ทานคู่กับยาประจำได้ไหม", d: "มีโรคประจำตัวหรือทานยาอยู่" },
    { v: "ปรึกษาสำหรับผู้สูงอายุที่บ้าน", d: "อยากดูแลคุณพ่อคุณแม่" },
    { v: "สอบถามโปรโมชั่น / วิธีสั่งซื้อ", d: "ราคาแพ็ก การจัดส่ง การชำระเงิน" },
    { v: "เรื่องอื่น ๆ", d: "" }
  ];
  var TIMES = ["เมื่อไหร่ก็ได้", "ช่วงเช้า (9:00–12:00)", "ช่วงบ่าย (12:00–16:00)", "ช่วงเย็น (16:00–19:00)"];

  var data = { topic: TOPICS[0].v, name: "", phone: "", time: TIMES[0] };
  var step = 0, busy = false;

  function renderStepper() {
    stepper.innerHTML =
      '<span class="stepper__fill" style="width:' + (step / (STEPS.length - 1) * 80) + '%"></span>' +
      STEPS.map(function (label, i) {
        var cls = i < step ? "is-done" : (i === step ? "is-current" : "");
        return '<span class="step ' + cls + '"><span class="step__dot">' + (i < step ? "✓" : (i + 1)) + "</span>" +
          '<span class="step__label">' + A.esc(label) + "</span></span>";
      }).join("");
  }

  function render() {
    renderStepper();
    if (step === 0) return renderTopic();
    if (step === 1) return renderContact();
    return renderDone();
  }

  /* ---- ขั้น 1: เลือกเรื่อง ---- */
  function renderTopic() {
    card.innerHTML =
      "<h2 style='font-size:1.2rem;margin:0 0 4px'>อยากปรึกษาเรื่องอะไร</h2>" +
      "<p style='color:var(--ink-soft);font-size:.9rem;margin:0 0 18px'>เลือก 1 ข้อ</p>" +
      '<div class="wz-opts">' + TOPICS.map(function (t, i) {
        return '<label class="wz-opt' + (data.topic === t.v ? " is-on" : "") + '">' +
          '<input type="radio" name="topic" value="' + i + '"' + (data.topic === t.v ? " checked" : "") + ">" +
          "<span><b>" + A.esc(t.v) + "</b>" + (t.d ? "<small>" + A.esc(t.d) + "</small>" : "") + "</span></label>";
      }).join("") + "</div>" +
      '<div class="wz-nav"><a class="btn btn--ghost" href="index.html">← กลับหน้าแรก</a>' +
        '<button class="btn btn--primary" id="wzNext">ต่อไป →</button></div>';

    A.$$(".wz-opt input", card).forEach(function (r) {
      r.addEventListener("change", function () {
        data.topic = TOPICS[+r.value].v;
        A.$$(".wz-opt", card).forEach(function (l) { l.classList.toggle("is-on", l.contains(r) && r.checked); });
      });
    });
    A.$("#wzNext").addEventListener("click", function () { step = 1; render(); });
  }

  /* ---- ขั้น 2: ข้อมูลติดต่อ (แค่ 3 ช่อง) ---- */
  function renderContact() {
    card.innerHTML =
      "<h2 style='font-size:1.2rem;margin:0 0 4px'>ให้เราติดต่อกลับยังไงดี</h2>" +
      "<p style='color:var(--ink-soft);font-size:.9rem;margin:0 0 18px'>กรอกแค่ชื่อกับเบอร์ ก็นัดได้แล้ว</p>" +
      '<div class="co-err" id="wzErr" hidden></div>' +
      '<div class="field"><label for="wzName">ชื่อของคุณ <span style="color:var(--danger)">*</span></label>' +
        '<input id="wzName" placeholder="เช่น คุณสมศรี" autocomplete="name" value="' + A.esc(data.name) + '"></div>' +
      '<div class="field"><label for="wzPhone">เบอร์โทรที่ติดต่อได้ <span style="color:var(--danger)">*</span></label>' +
        '<input id="wzPhone" inputmode="tel" placeholder="08X-XXX-XXXX" autocomplete="tel" value="' + A.esc(data.phone) + '"></div>' +
      '<div class="field"><label for="wzTime">ช่วงเวลาที่สะดวกให้โทรกลับ</label><select id="wzTime">' +
        TIMES.map(function (t) { return '<option' + (data.time === t ? " selected" : "") + ">" + A.esc(t) + "</option>"; }).join("") +
      "</select></div>" +
      '<div class="wz-nav"><button class="btn btn--ghost" id="wzBack">← ย้อนกลับ</button>' +
        '<button class="btn btn--primary" id="wzNext">ตรวจสอบ →</button></div>';

    A.$("#wzBack").addEventListener("click", function () { save(); step = 0; render(); });
    A.$("#wzNext").addEventListener("click", function () {
      save();
      var bad = [];
      if (data.name.trim().length < 2) bad.push("ชื่อ");
      if (data.phone.replace(/\D/g, "").length < 9) bad.push("เบอร์โทร");
      if (bad.length) {
        var el = A.$("#wzErr"); el.textContent = "กรุณากรอก: " + bad.join(", "); el.hidden = false;
        return;
      }
      step = 2; render();
    });
  }
  function save() {
    if (A.$("#wzName")) data.name = A.$("#wzName").value;
    if (A.$("#wzPhone")) data.phone = A.$("#wzPhone").value;
    if (A.$("#wzTime")) data.time = A.$("#wzTime").value;
  }

  /* ---- ขั้น 3: ยืนยัน → ส่ง ---- */
  function renderDone() {
    card.innerHTML =
      "<h2 style='font-size:1.2rem;margin:0 0 16px'>ตรวจสอบข้อมูลก่อนส่ง</h2>" +
      '<div class="co-err" id="wzErr" hidden></div>' +
      '<dl class="wz-summary">' +
        "<div><dt>เรื่องที่ปรึกษา</dt><dd>" + A.esc(data.topic) + "</dd></div>" +
        "<div><dt>ชื่อ</dt><dd>" + A.esc(data.name) + "</dd></div>" +
        "<div><dt>เบอร์โทร</dt><dd>" + A.esc(data.phone) + "</dd></div>" +
        "<div><dt>เวลาสะดวก</dt><dd>" + A.esc(data.time) + "</dd></div>" +
      "</dl>" +
      '<div class="wz-nav"><button class="btn btn--ghost" id="wzBack">← แก้ไข</button>' +
        '<button class="btn btn--primary btn--lg" id="wzSubmit">ยืนยันนัดปรึกษา</button></div>';

    A.$("#wzBack").addEventListener("click", function () { step = 1; render(); });
    A.$("#wzSubmit").addEventListener("click", submit);
  }

  function lineMessage() {
    return "ขอนัดปรึกษาผู้เชี่ยวชาญครับ/ค่ะ\n\n" +
      "เรื่อง: " + data.topic + "\n" +
      "ชื่อ: " + data.name + "\n" +
      "เบอร์: " + data.phone + "\n" +
      "เวลาสะดวก: " + data.time;
  }

  function submit() {
    if (busy) return;
    busy = true;
    var btn = A.$("#wzSubmit");
    btn.disabled = true; btn.textContent = "กำลังส่ง...";

    fetch("/api/create-consult", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || "ส่งไม่สำเร็จ");
        success(false);
      })
      .catch(function () {
        /* สำรอง: เปิด LINE พร้อมข้อความให้ทีมงาน */
        success(true);
      });
  }

  function success(viaLine) {
    step = STEPS.length - 1;
    renderStepper();
    A.$$(".step", stepper).forEach(function (el) { el.classList.remove("is-current"); el.classList.add("is-done"); });
    A.$(".stepper__fill", document).style.width = "80%";

    if (viaLine) {
      var url = s.contact.lineUrl + (s.contact.lineUrl.indexOf("?") > -1 ? "&" : "?") + "text=" + encodeURIComponent(lineMessage());
      try { window.open(url, "_blank", "noopener"); } catch (e) {}
    }

    card.innerHTML =
      "<div style='text-align:center'>" +
        "<div style='width:84px;height:84px;border-radius:50%;background:var(--sage-wash);display:grid;place-items:center;font-size:2.4rem;margin:0 auto 18px'>✅</div>" +
        "<h2 style='margin:0 0 8px'>ได้รับคำขอนัดแล้ว</h2>" +
        "<p style='color:var(--ink-soft);max-width:44ch;margin:0 auto 6px'>ทีมงานจะติดต่อกลับหาคุณ <b>" + A.esc(data.name) + "</b> ที่เบอร์ <b>" + A.esc(data.phone) + "</b> ในช่วง <b>" + A.esc(data.time) + "</b></p>" +
        (viaLine ? "<p style='color:var(--ink-soft);font-size:.9rem'>เราเปิดหน้าต่าง LINE ให้แล้ว กดส่งข้อความเพื่อยืนยันได้เลย</p>" : "") +
        "<div style='display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:22px'>" +
          '<a class="btn btn--line btn--lg" href="' + A.esc(s.contact.lineUrl) + '" target="_blank" rel="noopener">💬 คุยต่อทาง LINE</a>' +
          '<a class="btn btn--ghost btn--lg" href="shop.html">ดูสินค้าระหว่างรอ</a>' +
        "</div>" +
      "</div>";
  }

  render();
});
