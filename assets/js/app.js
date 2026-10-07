/* =========================================================
   BeautiQ — التطبيق الرئيسي (التوجيه / اللوحة / الإعدادات)
   ========================================================= */
const App = (() => {
  const TITLES = {
    dashboard:    ["لوحة التحكم", "Dashboard — نظرة عامة على المركز"],
    appointments: ["المواعيد والحجوزات", "Appointments — calendar, day view & reminders"],
    clients:      ["العملاء", "Clients — CRM, loyalty points & history"],
    services:     ["الخدمات", "Services — catalog, prices & durations"],
    inventory:    ["المخزون", "Inventory — products, stock & alerts"],
    finance:      ["المالية والفواتير", "Finance — invoices, expenses & summary"],
    employees:    ["الموظفون", "Staff — attendance, permissions & productivity"],
    reports:      ["التقارير", "Reports — detailed insights & print"],
    settings:     ["الإعدادات", "Settings — center profile, themes & backup"]
  };
  let current = "dashboard";

  /* ---------- التوجيه ---------- */
  function go(view) {
    if (!TITLES[view]) view = "dashboard";
    current = view;
    UI.$$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === view));
    UI.$$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));
    UI.$("#viewTitle").textContent = TITLES[view][0];
    UI.$("#viewSub").textContent = TITLES[view][1];
    UI.$("#sidebar").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
    render(view);
  }

  function render(view) {
    if (view === "dashboard") dashboard();
    if (view === "appointments") Appointments.render();
    if (view === "clients") Clients.render();
    if (view === "services") Services.render();
    if (view === "inventory") Inventory.render();
    if (view === "finance") Finance.render();
    if (view === "employees") Employees.render();
    if (view === "reports") Reports.render();
    if (view === "settings") settings();
  }

  function refreshSidebar() {
    const st = Store.get();
    UI.$("#miniClients").textContent = st.clients.length;
    UI.$("#miniAppts").textContent = st.appointments
      .filter(a => UI.dayKey(a.start) === UI.today() && a.status !== "cancel").length;
    UI.$("#miniInv").textContent = st.invoices.length;
    const low = UI.$("#miniLow");
    if (low) low.textContent = st.products.filter(p => Store.isLow(p)).length;
  }

  /* ---------- لوحة التحكم ---------- */
  let dashMetric = "appts";

  function last6Months() {
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() - i);
      out.push({ s: d.getTime(), e: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(),
                 lbl: String(d.getMonth() + 1) });
    }
    return out;
  }

  const PAL = ["#ff5c2b", "#059669", "#2f4fd9", "#ef8e13", "#8b5cf6", "#06b6d4"];

  function scheduleGrid(st, todays, today0) {
    const staff = st.staff.filter(s => s.active);
    if (!staff.length) return UI.empty("👨‍⚕️", "لا يوجد موظفون نشطون", "أضف موظفاً أولاً من صفحة الموظفين",
      `<button class="btn btn-primary" onclick="App.go('employees');setTimeout(()=>Employees.form(),200)">+ موظف جديد</button>`);
    let h0 = 9, h1 = 19;
    todays.forEach(a => { const h = new Date(a.start).getHours(); h0 = Math.min(h0, h); h1 = Math.max(h1, h + 1); });
    h1 = Math.min(h1, 23);
    if (h1 <= h0) h1 = h0 + 1;

    let html = `<div class="sg-wrap"><div class="sg" style="grid-template-columns:56px repeat(${staff.length},minmax(0,1fr))">`;
    html += `<div class="sg-hd">الوقت</div>`;
    staff.forEach((s, i) => {
      html += `<div class="sg-hd"><span class="dot" style="background:${PAL[i % PAL.length]}"></span>${UI.esc(s.name.split(" ").slice(0, 2).join(" "))}</div>`;
    });
    for (let h = h0; h < h1; h++) {
      html += `<div class="sg-t">${String(h).padStart(2, "0")}:00</div>`;
      staff.forEach((s, i) => {
        const c = PAL[i % PAL.length];
        const list = todays.filter(a => a.sid === s.id && new Date(a.start).getHours() === h);
        if (!list.length) {
          html += `<div class="sg-c" title="حجز في هذه الساعة" onclick="App.go('appointments');setTimeout(()=>Appointments.form(null,'${today0}',${h}),220)"></div>`;
          return;
        }
        html += `<div class="sg-c">` + list.map(a => {
          const cl = Store.getClient(a.cid) || {};
          const svc = a.items.map(it => it.name).join(" + ");
          const tm = UI.fmtTime(a.start).slice(0, 5);
          return `<div class="sg-ev" style="border-color:${c};background:color-mix(in srgb,${c} 9%,var(--panel))"
            onclick="event.stopPropagation();Appointments.detail('${a.id}')" title="${UI.esc(cl.name || "")} — ${tm}">
            <b>${UI.esc(cl.name || "—")}</b><span>${tm} · ${UI.esc(svc)}</span></div>`;
        }).join("") + `</div>`;
      });
    }
    return html + `</div></div>`;
  }

  function renderStats() {
    const st = Store.get(), ms = last6Months();
    let vals = [], unit = "موعد";
    if (dashMetric === "appts") {
      vals = ms.map(m => st.appointments.filter(a => a.status !== "cancel" && a.start >= m.s && a.start < m.e).length);
    } else if (dashMetric === "income") {
      vals = ms.map(m => st.invoices.filter(i => i.date >= m.s && i.date < m.e).reduce((t, i) => t + i.total, 0));
      unit = st.settings.currency === "USD" ? "$" : "د.ع";
    } else {
      vals = ms.map(m => st.clients.filter(c => c.createdAt >= m.s && c.createdAt < m.e).length);
      unit = "عميل";
    }
    UI.$("#dashStats").innerHTML = UI.lineChart(vals, { labels: ms.map(m => m.lbl), short: dashMetric === "income", unit });
    UI.$$("#dashStatTabs .tab").forEach(b => b.classList.toggle("active", b.dataset.m === dashMetric));
  }

  function renderRevenue() {
    const st = Store.get(), ms = last6Months();
    const items = ms.map(m => ({
      l: m.lbl,
      v: st.invoices.filter(i => i.date >= m.s && i.date < m.e).reduce((t, i) => t + i.total, 0),
      v2: st.expenses.filter(e => e.d >= m.s && e.d < m.e).reduce((t, e) => t + e.amount, 0)
    }));
    UI.$("#dashRevenue").innerHTML = UI.barChart(items) + `
      <div class="chart-legend">
        <span><i style="background:linear-gradient(145deg,#ff8b3d,#f4531a)"></i>الإيرادات</span>
        <span><i style="background:linear-gradient(145deg,#f87171,#dc2626)"></i>المصروفات</span>
      </div>`;
  }

  function dashboard() {
    const st = Store.get();
    const today0 = UI.today();
    const todays = st.appointments.filter(a => UI.dayKey(a.start) === today0 && a.status !== "cancel")
      .sort((a, b) => a.start - b.start);
    const m = Store.rangeThisMonth();
    const monthInc = st.invoices.filter(i => Store.inRange(i.date, ...Object.values(m))).reduce((t, i) => t + i.total, 0);
    const monthExp = st.expenses.filter(e => Store.inRange(e.d, ...Object.values(m))).reduce((t, e) => t + e.amount, 0);
    const todayInc = st.invoices.filter(i => UI.dayKey(i.date) === today0).reduce((t, i) => t + i.total, 0);
    const expected = todays.reduce((t, a) => t + a.price, 0);
    const newClients = st.clients.filter(c => Store.inRange(c.createdAt, ...Object.values(m))).length;

    UI.$("#dashCards").innerHTML = `
      <div class="card" data-ico="👥"><div class="k">إجمالي العملاء</div><div class="v">${st.clients.length}</div>
        <div class="s">${newClients} جديد هذا الشهر</div></div>
      <div class="card i2" data-ico="📅"><div class="k">مواعيد اليوم</div><div class="v">${todays.length}</div>
        <div class="s">${todays.filter(a => a.status === "done").length} منجز · ${UI.money(expected)} متوقع</div></div>
      <div class="card i3" data-ico="💰"><div class="k">إيراد الشهر</div><div class="v" style="font-size:17px">${UI.money(monthInc)}</div>
        <div class="s">صافي ${UI.money(monthInc - monthExp)} بعد المصروفات</div></div>
      <div class="card i4" data-ico="🧾"><div class="k">إيراد اليوم</div><div class="v" style="font-size:17px">${UI.money(todayInc)}</div>
        <div class="s">${st.invoices.filter(i => UI.dayKey(i.date) === today0).length} فاتورة اليوم</div></div>`;

    /* جدول اليوم حسب الموظف */
    UI.$("#dashSchedule").innerHTML = scheduleGrid(st, todays, today0);

    /* الإحصائيات + الإيرادات */
    renderStats();
    renderRevenue();

    /* النشاط */
    const act = st.activity || [];
    UI.$("#dashActivity").innerHTML = act.length
      ? act.slice(0, 8).map(a => `<div class="act"><span class="dot"></span>
          <div style="flex:1"><div class="t">${UI.esc(a.t)}</div>
          <div class="d">${UI.fmtDate(a.d)} · ${UI.fmtTime(a.d)}</div></div></div>`).join("")
      : `<p class="muted">لا يوجد نشاط بعد.</p>`;

    /* تنبيهات المخزون */
    const lows = st.products.filter(p => Store.isLow(p));
    UI.$("#dashAlerts").innerHTML = lows.length ? lows.slice(0, 5).map(p => `
      <div class="ex-row" style="grid-template-columns:1fr auto auto">
        <div><b style="color:var(--red)">${UI.esc(p.name)}</b>
          <div class="en">المتبقي ${p.qty} ${UI.esc(p.unit || "")} · الحد الأدنى ${p.min}</div></div>
        <span class="tag bad">ناقص</span>
        <button class="btn btn-sm btn-soft" onclick="Inventory.move('${p.id}')">توريد</button>
      </div>`).join("")
      : `<p class="muted" style="margin:0">✅ كل المخزون ضمن الحدود الآمنة.</p>`;
  }

  /* ---------- بحث عالمي ---------- */
  function search(q) {
    q = q.toLowerCase().trim();
    if (!q) return;
    const st = Store.get();
    const cls = st.clients.filter(c => (c.name + " " + (c.phone || "")).toLowerCase().includes(q)).slice(0, 5);
    const svs = st.services.filter(s => s.name.toLowerCase().includes(q)).slice(0, 4);
    const invs = st.invoices.filter(i => {
      const c = Store.getClient(i.cid);
      return (i.no + " " + ((c || {}).name || "")).toLowerCase().includes(q);
    }).slice(0, 4);
    const appts = st.appointments.filter(a => {
      const c = Store.getClient(a.cid);
      return ((c || {}).name || "").toLowerCase().includes(q);
    }).slice(0, 4);
    const none = !cls.length && !svs.length && !invs.length && !appts.length;

    UI.modal({
      title: `نتائج البحث عن «${q}»`, hideSave: true,
      body: none ? UI.empty("🔍", "لا توجد نتائج", "جرّب اسماً أو رقم هاتف أو رقم فاتورة") : `
        ${cls.length ? `<div class="sect-title">عملاء (${cls.length})</div>
          ${cls.map(c => `<div class="ex-row" style="cursor:pointer;grid-template-columns:1fr auto auto" data-goc="${c.id}">
            <div><b>${UI.esc(c.name)}</b><div class="en">${UI.esc(c.phone || "")}</div></div>
            <span class="tag">${c.points || 0} ⭐</span><span class="tag info">فتح</span></div>`).join("")}` : ""}
        ${appts.length ? `<div class="sect-title">مواعيد (${appts.length})</div>
          ${appts.map(a => `<div class="ex-row" style="cursor:pointer;grid-template-columns:1fr auto auto" data-goa="${a.id}">
            <div><b>${UI.esc((Store.getClient(a.cid) || {}).name || "")}</b>
              <div class="en">${UI.fmtDate(a.start)} · ${UI.fmtTime(a.start)}</div></div>
            <span class="tag">${UI.money(a.price)}</span><span class="tag info">فتح</span></div>`).join("")}` : ""}
        ${svs.length ? `<div class="sect-title">خدمات (${svs.length})</div>
          ${svs.map(s => `<div class="ex-row" style="grid-template-columns:1fr auto">
            <div><b>${UI.esc(s.name)}</b><div class="en">${(SERVICE_CATS[s.cat] || {}).ar}</div></div>
            <span class="tag mus">${UI.money(s.price)}</span></div>`).join("")}` : ""}
        ${invs.length ? `<div class="sect-title">فواتير (${invs.length})</div>
          ${invs.map(i => `<div class="ex-row" style="cursor:pointer;grid-template-columns:1fr auto auto" data-goi="${i.id}">
            <div><b>${i.no}</b><div class="en">${UI.fmtDate(i.date)} · ${UI.esc((Store.getClient(i.cid) || {}).name || "زائر")}</div></div>
            <span class="tag">${UI.money(i.total)}</span><span class="tag info">فتح</span></div>`).join("")}` : ""}`
    });

    UI.$("#modalBody").onclick = ev => {
      const t = ev.target.closest("[data-goc],[data-goa],[data-goi]"); if (!t) return;
      UI.closeModal();
      if (t.dataset.goc) { go("clients"); setTimeout(() => Clients.open(t.dataset.goc), 200); }
      if (t.dataset.goa) { go("appointments"); setTimeout(() => Appointments.detail(t.dataset.goa), 200); }
      if (t.dataset.goi) { go("finance"); setTimeout(() => Finance.viewInvoice(t.dataset.goi), 200); }
    };
  }

  /* ---------- النسخ الاحتياطي ---------- */
  function backup() {
    const blob = new Blob([Store.export()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `beautiq-backup-${UI.today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    UI.toast("تم تصدير النسخة الاحتياطية ⬇️");
  }

  function restore(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        Store.import(JSON.parse(r.result));
        refreshSidebar(); go(current);
        UI.toast("تم استيراد البيانات بنجاح ✓");
      } catch (e) { UI.toast("ملف غير صالح: " + e.message, "err"); }
    };
    r.readAsText(file);
  }

  /* ---------- الثيمات ---------- */
  const THEMES = [
    { k: "salon",  ar: "برتقالي عصري", en: "Modern Orange", ico: "🟠", short: "برتقالي",
      sw: ["#f4f6f9", "#ffffff", "#ff5c2b", "#f5a623"] },
    { k: "dark",   ar: "داكن كلاسيكي", en: "Dark Classic", ico: "🌙", short: "داكن",
      sw: ["#0d1117", "#161d2b", "#ff6b35", "#ffa542"] },
    { k: "light",  ar: "فاتح", en: "Light", ico: "☀️", short: "فاتح",
      sw: ["#f3f6fb", "#ffffff", "#ff6b35", "#e15514"] },
    { k: "ocean",  ar: "أزرق محيطي", en: "Ocean", ico: "🌊", short: "محيطي",
      sw: ["#061420", "#0e2032", "#22d3ee", "#7de3ff"] },
    { k: "violet", ar: "بنفسجي", en: "Violet", ico: "💜", short: "بنفسجي",
      sw: ["#0f0b1a", "#191231", "#a78bfa", "#c9bcff"] },
    { k: "rose",   ar: "روز وردي", en: "Rose", ico: "🌸", short: "روز",
      sw: ["#fdf2f7", "#ffffff", "#e8437f", "#c2185b"] },
    { k: "emerald",ar: "زمردي", en: "Emerald", ico: "🌿", short: "زمردي",
      sw: ["#071410", "#0f2a1f", "#10b981", "#6ee7b7"] },
    { k: "gold",   ar: "ذهبي فاخر", en: "Royal Gold", ico: "🏆", short: "ذهبي",
      sw: ["#14110c", "#221d15", "#e0b246", "#f6d477"] }
  ];
  const themeOf = k => THEMES.find(t => t.k === k) || THEMES[0];
  const currentTheme = () => (Store.get().settings || {}).theme || "salon";

  function applyTheme(key) {
    document.documentElement.setAttribute("data-theme", key);
    const lb = UI.$("#themeName");
    if (lb) lb.textContent = themeOf(key).short;
  }

  function setTheme(key) {
    const s = Store.get().settings;
    s.theme = key; Store.save();
    applyTheme(key);
    if (current === "settings") settings();
  }

  function cycleTheme() {
    const i = THEMES.findIndex(t => t.k === currentTheme());
    const n = THEMES[(i + 1) % THEMES.length];
    setTheme(n.k);
    UI.toast("الثيم: " + n.ar + " ✓");
  }

  function themeCards() {
    return THEMES.map(t => `
      <button class="theme-card ${t.k === currentTheme() ? "active" : ""}" data-theme-key="${t.k}">
        <span class="theme-ico">${t.ico}</span>
        <span class="theme-name">${t.ar}<em>${t.en}</em></span>
        <span class="theme-sw">${t.sw.map(c => `<i style="background:${c}"></i>`).join("")}</span>
        <span class="theme-check">✓</span>
      </button>`).join("");
  }

  /* ---------- الإعدادات ---------- */
  function settings() {
    const s = Store.get().settings;
    UI.$("#setCenter").value = s.center || "";
    UI.$("#setDoctor").value = s.doctor || "";
    UI.$("#setPhoneS").value = s.phone || "";
    UI.$("#setAddress").value = s.address || "";
    UI.$("#setCurrency").value = s.currency || "IQD";
    UI.$("#setRate").value = s.rate || 1310;
    UI.$("#setTax").value = s.tax || 0;
    UI.$("#setPointsPer").value = s.pointsPer || 100000;
    UI.$("#setPointValue").value = s.pointValue || 5000;

    const grid = UI.$("#themeGrid");
    grid.innerHTML = themeCards();
    grid.onclick = e => {
      const b = e.target.closest("[data-theme-key]");
      if (b) { setTheme(b.dataset.themeKey); UI.toast("الثيم: " + themeOf(b.dataset.themeKey).ar + " ✓"); }
    };
  }

  function saveSettings() {
    const s = Store.get().settings;
    s.center = UI.$("#setCenter").value.trim();
    s.doctor = UI.$("#setDoctor").value.trim();
    s.phone = UI.$("#setPhoneS").value.trim();
    s.address = UI.$("#setAddress").value.trim();
    s.currency = UI.$("#setCurrency").value;
    s.rate = Math.max(1, parseInt(UI.$("#setRate").value) || 1310);
    s.tax = Math.max(0, parseFloat(UI.$("#setTax").value) || 0);
    s.pointsPer = Math.max(1, parseInt(UI.$("#setPointsPer").value) || 100000);
    s.pointValue = Math.max(0, parseInt(UI.$("#setPointValue").value) || 5000);
    Store.save();
    UI.toast("حُفظت إعدادات المركز ✓");
    render(current);
  }

  /* ---------- التشغيل ---------- */
  function init() {
    Store.load();
    refreshSidebar();
    applyTheme(currentTheme());

    UI.$$("#mainNav .nav-item").forEach(b => b.onclick = () => go(b.dataset.view));
    UI.$("#navToggle").onclick = () => UI.$("#sidebar").classList.toggle("open");

    /* وحدات */
    Appointments.init(); Clients.init(); Services.init();
    Inventory.init(); Finance.init(); Employees.init(); Reports.init();

    /* إجراءات سريعة */
    UI.$$(".quick-actions .qa").forEach(b => b.onclick = () => {
      go(b.dataset.go);
      const act = b.dataset.act;
      if (!act) return;
      setTimeout(() => {
        if (act === "appt") Appointments.form();
        if (act === "client") Clients.form();
        if (act === "invoice") Finance.newInvoice();
        if (act === "expense") Finance.expenseForm();
        if (act === "product") Inventory.form();
        if (act === "staff") Employees.form();
      }, 250);
    });

    /* المودال */
    UI.$("#modalClose").onclick = UI.closeModal;
    UI.$("#modalBackdrop").onclick = e => { if (e.target.id === "modalBackdrop") UI.closeModal(); };
    UI.$("#modalFoot").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-x")) UI.closeModal();
      if (b.hasAttribute("data-save")) {
        const cb = window.__modalSave;
        if (cb) cb(); else UI.closeModal();
      }
    });
    UI.$("#drawerClose").onclick = UI.closeDrawer;
    UI.$("#drawerBackdrop").onclick = e => { if (e.target.id === "drawerBackdrop") UI.closeDrawer(); };
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") { UI.closeModal(); UI.closeDrawer(); }
      if (e.key === "Enter" && !UI.$("#modalBackdrop").hidden && e.target.tagName !== "TEXTAREA") {
        const cb = window.__modalSave;
        if (cb && !e.target.closest("[multiple]")) { e.preventDefault(); cb(); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); UI.$("#globalSearch").focus(); }
    });

    /* بحث */
    UI.$("#globalSearch").addEventListener("keydown", e => {
      if (e.key === "Enter") search(e.target.value);
    });

    /* زر الشريط الجانبي + تبويبات إحصائيات اللوحة */
    UI.$("#btnSideAdd").onclick = () => { go("clients"); setTimeout(() => Clients.form(), 220); };
    UI.$$("#dashStatTabs .tab").forEach(b => b.onclick = () => { dashMetric = b.dataset.m; renderStats(); });

    /* أزرار الشريط */
    UI.$("#btnTheme").onclick = cycleTheme;
    UI.$("#btnBackup").onclick = backup;
    UI.$("#btnExport2").onclick = backup;
    UI.$("#btnRestore").onclick = UI.$("#btnImport2").onclick = () => UI.$("#fileRestore").click();
    UI.$("#fileRestore").onchange = e => { if (e.target.files[0]) restore(e.target.files[0]); e.target.value = ""; };
    UI.$("#btnReset").onclick = () => UI.confirm(
      "سيتم حذف <b>كل</b> بيانات المركز (عملاء، مواعيد، فواتير، مخزون…) نهائياً. هل أنت متأكد؟",
      () => { Store.reset(); refreshSidebar(); go("dashboard"); UI.toast("تم تصفير البيانات", "warn"); });

    UI.$("#btnSaveSettings").onclick = saveSettings;

    go("dashboard");
  }

  document.addEventListener("DOMContentLoaded", init);

  return { go, render, refreshSidebar, backup, search,
           closeDrawer: UI.closeDrawer, closeModal: UI.closeModal, settings,
           redraw: () => render(current) };
})();
