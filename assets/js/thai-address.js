/* ============================================================
   thai-address.js — Dropdown ที่อยู่ไทยแบบเลือกต่อกัน
   จังหวัด → อำเภอ/เขต → ตำบล/แขวง → เติมรหัสไปรษณีย์อัตโนมัติ
   ข้อมูลจาก assets/data/thai-geo.json (77 จังหวัด · 7,498 ตำบล)
   ============================================================ */
(function () {
  "use strict";
  var GEO_URL = "assets/data/thai-geo.json?v=1";
  var prov = document.getElementById("fProvince");
  var dist = document.getElementById("fDistrict");
  var sub  = document.getElementById("fSubdistrict");
  var zip  = document.getElementById("fZip");
  if (!prov || !dist || !sub || !zip) return;

  var DATA = [];

  /* เรียงตามพจนานุกรมไทยด้วย collation ของเบราว์เซอร์ */
  function byTh(key) {
    return function (x, y) { return String(x[key]).localeCompare(String(y[key]), "th"); };
  }
  function sortProvinces(list) {
    return list.slice().sort(function (x, y) {
      if (x.p === "กรุงเทพมหานคร") return -1;
      if (y.p === "กรุงเทพมหานคร") return 1;
      return x.p.localeCompare(y.p, "th");
    });
  }

  function opt(val, label) {
    var o = document.createElement("option");
    o.value = val; o.textContent = label || val;
    return o;
  }
  function reset(sel, placeholder) {
    sel.innerHTML = "";
    sel.appendChild(opt("", placeholder));
    sel.disabled = true;
  }
  function findProvince(name) {
    for (var i = 0; i < DATA.length; i++) if (DATA[i].p === name) return DATA[i];
    return null;
  }
  function findAmphoe(p, name) {
    if (!p) return null;
    for (var i = 0; i < p.a.length; i++) if (p.a[i].a === name) return p.a[i];
    return null;
  }

  /* ถ้าโหลดข้อมูลไม่สำเร็จ — เปลี่ยน select กลับเป็นช่องพิมพ์เอง กันลูกค้าสั่งซื้อไม่ได้ */
  function fallbackToText() {
    [prov, dist, sub].forEach(function (s) {
      var inp = document.createElement("input");
      inp.id = s.id; inp.name = s.name;
      inp.setAttribute("autocomplete", s.getAttribute("autocomplete") || "");
      inp.placeholder = "พิมพ์เอง";
      s.parentNode.replaceChild(inp, s);
    });
    zip.removeAttribute("readonly");
    zip.placeholder = "รหัสไปรษณีย์";
  }

  fetch(GEO_URL)
    .then(function (r) { if (!r.ok) throw new Error("geo " + r.status); return r.json(); })
    .then(function (d) {
      DATA = (d && d.provinces) || [];
      if (!DATA.length) throw new Error("empty");
      sortProvinces(DATA).forEach(function (p) { prov.appendChild(opt(p.p)); });
      prov.disabled = false;
    })
    .catch(function () { fallbackToText(); });

  prov.addEventListener("change", function () {
    reset(dist, "— เลือกอำเภอ/เขต —");
    reset(sub, "— เลือกตำบล/แขวง —");
    zip.value = "";
    var p = findProvince(prov.value);
    if (!p) return;
    p.a.slice().sort(byTh("a")).forEach(function (a) { dist.appendChild(opt(a.a)); });
    dist.disabled = false;
  });

  dist.addEventListener("change", function () {
    reset(sub, "— เลือกตำบล/แขวง —");
    zip.value = "";
    var a = findAmphoe(findProvince(prov.value), dist.value);
    if (!a) return;
    a.t.slice().sort(byTh("t")).forEach(function (t) {
      var o = opt(t.t);
      o.setAttribute("data-zip", t.z);
      sub.appendChild(o);
    });
    sub.disabled = false;
  });

  sub.addEventListener("change", function () {
    var o = sub.options[sub.selectedIndex];
    zip.value = (o && o.getAttribute("data-zip")) || "";
  });
})();
