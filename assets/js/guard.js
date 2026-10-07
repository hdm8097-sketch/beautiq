/* =========================================================
   BeautiQ — قفل الإدارة (Admin Lock)
   التعديلات والحذف وتغيير الإعدادات للمدير فقط عبر رمز PIN،
   وبدون الرمز تُعرض البيانات للمشاهدة فقط.
   ========================================================= */
window.Guard = (() => {
  const $ = (s, r = document) => r.querySelector(s);

  let unlocked = false;   /* جلسة الإدارة مفتوحة — تُغلق تلقائياً عند إعادة التحميل */
  let pending = null;     /* الإجراء المؤجّل حتى إدخال الرمز */
  let mode = "unlock", shownKey = "";
  let fails = 0, until = 0, lastBlockedToast = 0;

  /* ================= تجزئة الرموز ================= */
  const SALT = "BeautiQ·admin·v1·";

  function fnv(str) {
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 + c, 0x85ebca6b);
    }
    return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
  }

  async function hash(val) {
    const data = new TextEncoder().encode(SALT + val);
    if (window.crypto && crypto.subtle && window.isSecureContext) {
      try {
        const buf = await crypto.subtle.digest("SHA-256", data);
        return "s$" + [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
      } catch (e) { /* السقوط إلى البديل أدناه */ }
    }
    return "f$" + fnv(SALT + val) + fnv(SALT + "#" + val);
  }

  const verify = async (val, stored) => !!val && !!stored && (await hash(val)) === stored;

  /* ================= الحالة ================= */
  function admin() {
    const s = Store.get();
    if (!s) return { pin: "", rec: "", createdAt: 0 };
    if (!s.admin) s.admin = { pin: "", rec: "", createdAt: 0 };
    return s.admin;
  }
  const configured = () => !!admin().pin;
  function blocks() { return configured() && !unlocked; }   /* تستخدمها طبقة الحفظ */

  function blockedSave() {
    const now = Date.now();
    if (now - lastBlockedToast > 2500) {
      lastBlockedToast = now;
      UI.toast("🔒 التعديلات مقفلة — أدخل رمز المسؤول ثم أعد المحاولة", "warn");
    }
    setTimeout(() => { if (window.App && App.redraw) { try { App.redraw(); } catch (e) {} } }, 0);
  }

  /* ================= واجهة القفل ================= */
  function ensureDOM() {
    if ($("#guardBackdrop")) return;
    const bd = document.createElement("div");
    bd.className = "modal-backdrop"; bd.id = "guardBackdrop"; bd.hidden = true;
    bd.innerHTML = `<div class="modal guard-modal" role="dialog" aria-modal="true">
      <div class="modal-hd"><h3 id="gTitle"></h3></div>
      <div class="modal-bd" id="gBody"></div>
      <div class="modal-ft" id="gFoot"></div></div>`;
    document.body.appendChild(bd);
  }

  const isOpen = () => { const b = $("#guardBackdrop"); return !!b && !b.hidden; };

  function closeG() {
    const b = $("#guardBackdrop"); if (!b) return;
    b.hidden = true;
    const appOpen = (!$("#modalBackdrop").hidden) || (!$("#drawerBackdrop").hidden);
    if (!appOpen) document.body.style.overflow = "";
  }

  const LBL = { setup: "إنشاء الرمز", unlock: "فتح التعديلات", forgot: "متابعة",
                vcur: "متابعة", change: "حفظ الرمز", showkey: "تم — متابعة" };
  const TIT = { setup: "🔐 إنشاء رمز المسؤول", unlock: "🔒 دخول المسؤول",
                forgot: "🔑 استرداد الوصول", vcur: "🔑 تغيير رمز المسؤول",
                change: "🔑 تغيير رمز المسؤول", showkey: "🔑 رمز الاسترداد" };

  function renderG() {
    const err = `<div class="g-err" id="gErr" hidden></div>`;
    const pin = (id, ph) => `<input class="g-in" id="${id}" type="password" inputmode="numeric"
      autocomplete="new-password" maxlength="8" placeholder="${ph}">`;
    let body = "";
    if (mode === "setup") {
      body = `<p class="muted">لحماية البرنامج: أنشئ رمزاً من <b>4 إلى 8 أرقام</b>.
        كل تعديل أو حذف أو تغيير إعدادات يتطلب هذا الرمز — وبدونه تُعرض البيانات للمشاهدة فقط.</p>
        ${pin("gPin", "رمز جديد — 4 إلى 8 أرقام")}${pin("gPin2", "أعد إدخال الرمز")}${err}`;
    } else if (mode === "vcur") {
      body = `<p class="muted">أدخل رمز المسؤول <b>الحالي</b> للمتابعة إلى تغييره.</p>
        ${pin("gPin", "الرمز الحالي")}${err}`;
    } else if (mode === "change") {
      body = `<p class="muted">أدخل رمز المسؤول الجديد مرتين.</p>
        ${pin("gPin", "الرمز الجديد")}${pin("gPin2", "أعد إدخال الرمز")}${err}`;
    } else if (mode === "unlock") {
      body = `<p class="muted">أدخل رمز المسؤول لفتح التعديلات. (المشاهدة متاحة دائماً)</p>
        ${pin("gPin", "••••")}
        <button class="g-link" id="gAlt" type="button">نسيت الرمز؟ استرداد برمز الطوارئ</button>${err}`;
    } else if (mode === "forgot") {
      body = `<p class="muted">أدخل رمز الاسترداد (الطوارئ) الذي حفظته عند إنشاء الرمز، ثم أنشئ رمزاً جديداً.</p>
        <input class="g-in" id="gKeyIn" type="text" autocomplete="off" spellcheck="false"
          placeholder="BQ-XXXX-XXXX-XXXX" style="letter-spacing:.12em">${err}`;
    } else {
      body = `<p class="muted">احفظ رمز الاسترداد في مكان آمن (ورقة أو مدير كلمات المرور).
        يُستخدم لاستعادة الوصول إذا نسيت الرمز، <b>ولن يُعرض بعد اليوم.</b></p>
        <div class="g-key" id="gKey">${shownKey}</div>
        <button class="btn btn-soft" id="gCopy" type="button">📋 نسخ الرمز</button>${err}`;
    }
    $("#gTitle").textContent = TIT[mode];
    $("#gBody").innerHTML = body;
    $("#gFoot").innerHTML = mode === "showkey"
      ? `<button class="btn btn-primary" id="gOk">${LBL.showkey}</button>`
      : `<button class="btn btn-soft" id="gNo">${mode === "forgot" ? "رجوع" : "إلغاء"}</button>
         <button class="btn btn-primary" id="gOk">${LBL[mode]}</button>`;

    $("#gOk").onclick = submitG;
    const no = $("#gNo");
    if (no) no.onclick = () => {
      if (mode === "forgot") { mode = "unlock"; renderG(); }
      else cancelG();
    };
    const alt = $("#gAlt");
    if (alt) alt.onclick = () => { mode = "forgot"; renderG(); };
    const cp = $("#gCopy");
    if (cp) cp.onclick = copyKey;

    setTimeout(() => { const i = $("#gPin") || $("#gKeyIn"); if (i) i.focus(); }, 60);
    if (Date.now() < until) startWait();
  }

  function openG(m) {
    ensureDOM();
    mode = m; renderG();
    $("#guardBackdrop").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeAndFlush() { closeG(); flush(); }

  /* ================= منطق الأزرار ================= */
  function showErr(m) { const el = $("#gErr"); if (el) { el.textContent = m; el.hidden = false; } }

  function fail(msg) {
    showErr(msg);
    if (++fails >= 5) { fails = 0; until = Date.now() + 15000; startWait(); }
  }

  function startWait() {
    const btn = $("#gOk"); if (!btn) return;
    const tick = () => {
      const left = Math.ceil((until - Date.now()) / 1000);
      if (left <= 0) { btn.disabled = false; btn.textContent = LBL[mode]; return; }
      btn.disabled = true;
      btn.textContent = `انتظر ${left} ثانية`;
      setTimeout(tick, 1000);
    };
    tick();
  }

  function recKey() {
    const cs = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let out = "";
    if (window.crypto && crypto.getRandomValues) {
      const buf = new Uint8Array(12); crypto.getRandomValues(buf);
      for (let i = 0; i < 12; i++) out += cs[buf[i] % cs.length];
    } else {
      for (let i = 0; i < 12; i++) out += cs[Math.floor(Math.random() * cs.length)];
    }
    return "BQ-" + out.slice(0, 4) + "-" + out.slice(4, 8) + "-" + out.slice(8);
  }

  async function commit(pin, rec) {
    unlocked = true;   /* قبل الحفظ حتى تمرّ عملية save() */
    const a = admin();
    a.pin = await hash(pin);
    if (rec) a.rec = await hash(rec);   /* رمز الاسترداد يبقى كما هو عند تغيير الرمز */
    a.createdAt = Date.now();
    Store.save();
    updateBadge(); renderPanel();
  }

  async function submitG() {
    if (Date.now() < until) return;
    if (mode === "showkey") { closeAndFlush(); return; }

    if (mode === "setup" || mode === "change") {
      const p1 = $("#gPin") ? $("#gPin").value.trim() : "";
      const p2 = $("#gPin2") ? $("#gPin2").value.trim() : "";
      if (!/^\d{4,8}$/.test(p1)) return showErr("الرمز رقمي من 4 إلى 8 أرقام فقط");
      if (p1 !== p2) return showErr("الرمزان غير متطابقين");
      const rk = mode === "change" ? null : recKey();
      await commit(p1, rk);
      if (mode === "change") { closeAndFlush(); UI.toast("🔑 تم تغيير رمز المسؤول ✓"); return; }
      shownKey = rk; mode = "showkey"; renderG();
      return;
    }

    if (mode === "vcur") {
      const p = $("#gPin") ? $("#gPin").value.trim() : "";
      if (!p) return showErr("أدخل الرمز الحالي");
      if (await verify(p, admin().pin)) { fails = 0; mode = "change"; renderG(); }
      else fail("الرمز الحالي غير صحيح");
      return;
    }

    if (mode === "unlock") {
      const p = $("#gPin") ? $("#gPin").value.trim() : "";
      if (!p) return showErr("أدخل الرمز");
      if (await verify(p, admin().pin)) {
        unlocked = true;
        fails = 0;
        updateBadge(); renderPanel();
        closeAndFlush();
        UI.toast("🔓 فُتحت الإدارة — التعديلات متاحة الآن ✓");
      } else {
        fail("رمز غير صحيح");
        const gi = $("#gPin"); if (gi) { gi.value = ""; gi.focus(); }
      }
      return;
    }

    if (mode === "forgot") {
      const k = $("#gKeyIn") ? $("#gKeyIn").value.trim().toUpperCase() : "";
      if (!k) return showErr("أدخل رمز الاسترداد");
      if (await verify(k, admin().rec)) { fails = 0; mode = "setup"; renderG(); }
      else fail("رمز استرداد غير صحيح");
      return;
    }
  }

  function copyKey() {
    const done = () => UI.toast("نُسخ رمز الاسترداد ✓");
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = shownKey; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { UI.toast("انسخ الرمز يدوياً", "warn"); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(shownKey).then(done).catch(fallback);
    else fallback();
  }

  /* ================= بوابة التعديلات ================= */
  function gate(cb) {
    if (unlocked) return cb ? cb() : undefined;
    if (isOpen()) { if (cb) pending = cb; return; }
    pending = cb || null;
    openG(configured() ? "unlock" : "setup");
    return undefined;
  }

  function flush() {
    const cb = pending; pending = null;
    if (cb) setTimeout(() => { try { cb(); } catch (e) { console.error(e); } }, 30);
  }

  function cancelG() { closeG(); pending = null; }

  function lockNow() {
    unlocked = false; pending = null;
    closeG(); UI.closeModal(); UI.closeDrawer();
    updateBadge(); renderPanel();
    UI.toast("🔒 تم قفل إدارة التعديلات");
  }

  /* ================= الشارة والإعدادات ================= */
  function updateBadge() {
    const b = $("#btnGuard"); if (!b) return;
    if (!configured()) {
      b.innerHTML = "🔐 تفعيل القفل";
      b.className = "btn btn-ghost";
      b.title = "إنشاء رمز المسؤول — للمدير فقط";
    } else if (unlocked) {
      b.innerHTML = "🔓 الإدارة مفتوحة";
      b.className = "btn btn-ghost g-open";
      b.title = "انقر للقفل الآن";
    } else {
      b.innerHTML = "🔒 مقفل";
      b.className = "btn btn-ghost g-locked";
      b.title = "التعديلات مقفلة — انقر لفتح التعديلات";
    }
  }

  function renderPanel() {
    const el = $("#gStat"); if (!el) return;
    if (!configured())
      el.innerHTML = "⚙️ <b>لم يُنشأ رمز بعد</b> — سيُطلب إنشاؤه عند أول تعديل.";
    else if (unlocked)
      el.innerHTML = "🔓 <b>القفل مفعّل</b> — الإدارة مفتوحة في هذه الجلسة حتى إعادة التحميل.";
    else
      el.innerHTML = "🔒 <b>القفل مفعّل</b> — التعديلات والحذف وتغيير الإعدادات تتطلب رمز المسؤول.";
  }

  function badgeClick() {
    if (unlocked) {
      UI.confirm("قفل إدارة التعديلات الآن؟<br><span class=\"muted\" style=\"font-size:13px\">ستُطلب إعادة إدخال الرمز عند أي تعديل.</span>",
        lockNow, false);
    } else {
      gate(null);
    }
  }

  /* ================= اعتراض النقرات ================= */
  /* أزرار/عناصر التعديل المعروفة */
  const BLOCK_SEL = '[id^="btnAdd"], #btnNewInvoice, #btnCheckIn, #btnSideAdd, #btnSaveSettings, ' +
    '#btnTheme, #btnRestore, #btnImport2, #btnReset, .quick-actions .qa[data-act], ' +
    '[data-theme-key], #modalFoot [data-save]';

  /* نصوص onclick المكتوبة في HTML: أنماط التعديل */
  const MUT_OH = [/form\s*\(/i, /\.remove\s*\(/, /\.del\s*\(/, /delInvoice/, /newInvoice/,
    /invoiceFromAppt/, /expenseForm/, /setStatus/, /\.complete\s*\(/, /\.move\s*\(/,
    /\.quick\s*\(/, /\.perms\s*\(/, /btnAdd/, /\.click\s*\(/, /checkIn/, /\.redeem\s*\(/,
    /\.addPoints\s*\(/, /setTheme\s*\(/, /saveSettings\s*\(/, /Store\s*\.\s*(save|import|reset)/];

  /* نصوص آمنة (مشاهدة/تنقّل/طباعة) */
  const SAFE_OH = [/App\.go\s*\(/, /\.detail\s*\(/, /viewInvoice\s*\(/, /printInvoice\s*\(/];

  /* مُعيّن أن المُعالج مُسند عبر الخاصية (function/…) وليس نصاً مكتوباً في HTML */
  const PROP_SRC = /^\s*(function\b|\(|[A-Za-z_$][\w$]*\s*=>)/;

  function ohBlocks(attr) {
    if (MUT_OH.some(r => r.test(attr))) return true;
    if (SAFE_OH.some(r => r.test(attr))) return false;
    return !PROP_SRC.test(attr);   /* نص مكتوب غير معروف → نمنع؛ معالج مُسند → نسمح ونُعتمد على الطبقات الأخرى */
  }

  document.addEventListener("click", e => {
    if (unlocked || !e.target || !e.target.closest) return;
    const t = e.target;
    if (t.closest("#guardBackdrop")) return;      /* واجهة القفل نفسها */
    const sel = t.closest(BLOCK_SEL);
    const oh = sel ? null : t.closest("[onclick]");
    let block = false, el = null;
    if (sel) { block = true; el = sel; }
    else if (oh) { const a = oh.getAttribute("onclick") || ""; block = ohBlocks(a); el = oh; }
    if (!block) return;
    e.preventDefault(); e.stopPropagation();
    gate(() => { setTimeout(() => { try { el.click(); } catch (err) {} }, 40); });
  }, true);

  document.addEventListener("keydown", e => {
    if (isOpen()) {
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); submitG(); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancelG(); }
      return;
    }
    if (unlocked) return;
    /* منع حفظ مودال التطبيق بمفتاح Enter وهو مقفل */
    const mb = $("#modalBackdrop");
    if (!mb.hidden && e.key === "Enter" && window.__modalSave) {
      e.preventDefault(); e.stopPropagation();
      gate(() => { const cb = window.__modalSave; if (cb) cb(); });
    }
  }, true);

  /* حظر استيراد الملف وهو مقفل (شبكة أمان) */
  document.addEventListener("change", e => {
    if (unlocked) return;
    if (e.target && e.target.id === "fileRestore") {
      e.target.value = "";
      UI.toast("🔒 الاستيراد مقفل — أدخل رمز المسؤول أولاً", "warn");
    }
  }, true);

  /* ================= تغليف دوال التعديل ================= */
  const MUT_NAME = /^(form|del|remove|new|expense|move|quick|set|complete|perms|check|add|redeem|save|edit|create|import|reset|restore|invoiceFrom)/i;
  const VIEWS = ["Clients", "Appointments", "Services", "Inventory", "Finance", "Employees", "Reports"];

  function wrapViews() {
    VIEWS.forEach(name => {
      const o = window[name];
      if (!o || typeof o !== "object") return;
      Object.keys(o).forEach(k => {
        const fn = o[k];
        if (typeof fn !== "function" || !MUT_NAME.test(k) || fn.__g) return;
        const w = function (...a) {
          return gate(() => { try { return fn.apply(o, a); } catch (e) { console.error(e); } });
        };
        w.__g = 1;
        o[k] = w;
      });
    });
  }

  /* ================= التهيئة ================= */
  ensureDOM();

  document.addEventListener("DOMContentLoaded", () => {
    /* بعد تهيئة التطبيق (Store.load) مباشرةً */
    setTimeout(() => {
      updateBadge(); renderPanel();
      const gb = $("#btnGuard");
      if (gb) gb.onclick = badgeClick;

      const ch = $("#gBtnChange");
      if (ch) ch.onclick = () => {
        if (!configured()) openG("setup");
        else openG("vcur");
      };

      const dis = $("#gBtnDisable");
      if (dis) dis.onclick = () => {
        if (!configured()) { UI.toast("لم يتم إنشاء رمز بعد", "warn"); return; }
        gate(() => UI.confirm(
          "هل تريد <b>تعطيل</b> قفل الإدارة نهائياً؟ سيُسمح بالتعديلات للجميع بدون رمز.",
          () => {
            const a = admin(); a.pin = ""; a.rec = ""; a.createdAt = 0;
            Store.save(); unlocked = false;
            updateBadge(); renderPanel();
            UI.toast("تم تعطيل قفل الإدارة", "warn");
          }, true));
      };

      wrapViews();
    }, 0);
  });

  return { blocks, blockedSave, gate, lockNow, isUnlocked: () => unlocked, configured };
})();
