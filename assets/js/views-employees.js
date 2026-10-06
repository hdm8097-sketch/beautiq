/* =========================================================
   BeautiQ — الموظفون (بيانات / حضور / صلاحيات / إنتاجية)
   ========================================================= */
const Employees = (() => {
  const f = { q: "", role: "" };

  function init() {
    UI.$("#btnAddStaff").addEventListener("click", () => form());
    UI.$("#stSearch").addEventListener("input", e => { f.q = e.target.value.trim(); render(); });
    UI.$("#stRole").addEventListener("change", e => { f.role = e.target.value; render(); });
    UI.$("#btnCheckIn").addEventListener("click", checkInModal);
    UI.$("#btnPrintStaff").addEventListener("click", printList);
    const s = UI.$("#stRole");
    Object.entries(ROLES).forEach(([k, v]) =>
      s.insertAdjacentHTML("beforeend", `<option value="${k}">${v.ar}</option>`));
  }

  /* ---------- حضور سريع ---------- */
  function checkInModal() {
    const st = Store.get();
    const k = UI.today();
    const present = st.attendance.filter(a => UI.dayKey(a.d) === k).map(a => a.sid);
    UI.modal({
      title: "تسجيل حضور / انصراف اليوم",
      body: st.staff.filter(s => s.active).map(s => {
        const rec = st.attendance.find(a => UI.dayKey(a.d) === k && a.sid === s.id);
        return `<div class="ex-row" style="grid-template-columns:1fr auto auto auto">
          <div><b>${UI.esc(s.name)}</b><div class="en">${(ROLES[s.role] || {}).ar}</div></div>
          ${rec ? `<span class="tag ok">حضور ${UI.fmtTime(rec.in)}</span>` : `<span class="tag">غائب</span>`}
          ${rec && !rec.out ? `<button class="btn btn-sm btn-soft" data-out="${s.id}">انصراف</button>`
            : rec ? `<span class="tag info">${UI.fmtTime(rec.out)}</span>` : `<span></span>`}
          ${!rec ? `<button class="btn btn-sm btn-primary" data-in="${s.id}">حضور</button>` : `<span></span>`}
        </div>`;
      }).join(""),
      hideSave: true
    });
    UI.$("#modalBody").onclick = ev => {
      const i = ev.target.closest("[data-in]"), o = ev.target.closest("[data-out]");
      if (i) {
        st.attendance.push({ id: Store.uid("at"), sid: i.dataset.in, d: Date.now(), in: Date.now(), out: null, note: "" });
        Store.log(`حضور: ${(Store.getStaff(i.dataset.in) || {}).name}`); Store.save();
        UI.closeModal(); render(); checkInModal();
      }
      if (o) {
        const rec = st.attendance.find(a => UI.dayKey(a.d) === k && a.sid === o.dataset.out);
        if (rec) rec.out = Date.now();
        Store.log(`انصراف: ${(Store.getStaff(o.dataset.out) || {}).name}`); Store.save();
        UI.closeModal(); render(); checkInModal();
      }
    };
  }

  function render() {
    const st = Store.get();
    let list = st.staff.slice();
    if (f.role) list = list.filter(s => s.role === f.role);
    if (f.q) list = list.filter(s => (s.name + " " + (s.phone || "")).toLowerCase().includes(f.q.toLowerCase()));

    const k = UI.today();
    const present = st.attendance.filter(a => UI.dayKey(a.d) === k).length;
    const month = Store.rangeThisMonth();
    UI.$("#stStats").innerHTML = `
      <div class="card" data-ico="👨‍⚕️"><div class="k">عدد الموظفين</div><div class="v">${st.staff.filter(s => s.active).length}</div>
        <div class="s">${st.staff.filter(s => !s.active).length} غير نشط</div></div>
      <div class="card i2" data-ico="🕐"><div class="k">الحاضرون اليوم</div><div class="v">${present}</div>
        <div class="s">من ${st.staff.filter(s => s.active).length}</div></div>
      <div class="card i3" data-ico="💵"><div class="k">كتلة الرواتب الشهرية</div><div class="v" style="font-size:17px">${UI.money(st.staff.filter(s => s.active).reduce((t, s) => t + (s.salary || 0), 0))}</div>
        <div class="s">قبل الحوافز</div></div>
      <div class="card i4" data-ico="📋"><div class="k">مواعيد الشهر الموزّعة</div><div class="v">${st.appointments.filter(a => Store.inRange(a.start, ...Object.values(month))).length}</div>
        <div class="s">على ${new Set(st.appointments.filter(a => a.sid).map(a => a.sid)).size} موظف</div></div>`;

    if (!list.length) {
      UI.$("#stGrid").innerHTML = UI.empty("👨‍⚕️", "لا يوجد موظفون", "أضف فريق العمل لبدء متابعة الحضور والإنتاجية",
        `<button class="btn btn-primary" onclick="document.getElementById('btnAddStaff').click()">+ موظف جديد</button>`);
      return;
    }

    UI.$("#stGrid").innerHTML = list.map(s => {
      const myAppts = st.appointments.filter(a => a.sid === s.id);
      const monthAppts = myAppts.filter(a => Store.inRange(a.start, ...Object.values(month)));
      const done = myAppts.filter(a => a.status === "done");
      const revenue = done.reduce((t, a) => t + a.price, 0);
      const att = st.attendance.filter(a => a.sid === s.id && Store.inRange(a.d, ...Object.values(month)));
      const days = att.filter(a => a.out).length;
      const hours = Math.round(att.reduce((t, a) => t + ((a.out || Date.now()) - a.in) / 3600000, 0));
      const rec = st.attendance.find(a => UI.dayKey(a.d) === k && a.sid === s.id);
      const perms = Object.entries(s.perms || {}).filter(([, v]) => v).map(([p]) => PERMS[p]).filter(Boolean);

      return `<article class="item">
        <div class="item-hd">
          <div style="display:flex;gap:10px;align-items:center">
            <div class="avatar ${UI.grad(s.id)}">${UI.esc(UI.initials(s.name))}</div>
            <div><h3>${UI.esc(s.name)}</h3><div class="en">${(ROLES[s.role] || {}).ar} · ${UI.esc(s.phone || "")}</div></div>
          </div>
          ${rec ? UI.tag("🟢 حاضر", "ok") : UI.tag("غير حاضر", "")}
        </div>
        <div class="item-bd">
          <div class="kv"><span>مواعيد الشهر</span><b>${monthAppts.length}</b></div>
          <div class="kv"><span>منجزة (كل الأوقات)</span><b>${done.length}</b></div>
          <div class="kv"><span>الإيراد المُنجز</span><b class="money" style="color:var(--green)">${UI.money(revenue)}</b></div>
          <div class="kv"><span>أيام الحضور (الشهر)</span><b>${days} يوم · ${hours} ساعة</b></div>
          <div class="kv"><span>الراتب</span><b class="money">${UI.money(s.salary || 0)}</b></div>
          <div class="stat-line">${perms.length ? perms.slice(0, 4).map(p => UI.tag(p)).join("") : UI.tag("بلا صلاحيات", "bad")}</div>
        </div>
        <div class="item-ft">
          <button class="btn btn-sm btn-ghost" data-perm="${s.id}">🔐</button>
          <button class="btn btn-sm btn-ghost" data-edit="${s.id}">✏️</button>
          <button class="btn btn-sm btn-primary" data-open="${s.id}">الملف</button>
        </div>
      </article>`;
    }).join("");

    UI.$("#stGrid").onclick = ev => {
      const t = ev.target.closest("button"); if (!t) return;
      if (t.dataset.open) open(t.dataset.open);
      if (t.dataset.edit) form(Store.getStaff(t.dataset.edit));
      if (t.dataset.perm) perms(Store.getStaff(t.dataset.perm));
    };
  }

  /* ---------- نموذج الموظف ---------- */
  function form(s) {
    const editing = !!s;
    UI.modal({
      title: editing ? "تعديل بيانات الموظف" : "إضافة موظف جديد",
      body: `<div class="form-grid">
        <label>الاسم الكامل *<input type="text" id="stName" value="${UI.esc(s ? s.name : "")}"></label>
        <label>المسمى الوظيفي<select id="stRoleF">${Object.entries(ROLES).map(([k, v]) =>
          `<option value="${k}" ${s && s.role === k ? "selected" : ""}>${v.ar}</option>`).join("")}</select></label>
        <label>الهاتف<input type="tel" id="stPhone" value="${UI.esc(s ? s.phone || "" : "")}"></label>
        <label>الراتب الشهري (د.ع)<input type="number" id="stSalary" value="${s ? s.salary || 0 : 0}" min="0" step="50000"></label>
      </div>
      <label class="chk"><input type="checkbox" id="stActive" ${!s || s.active ? "checked" : ""}> موظف نشط (يعمل حالياً)</label>`,
      saveText: editing ? "حفظ" : "إضافة",
      onSave() {
        const name = UI.$("#stName").value.trim();
        if (!name) return UI.toast("أدخل اسم الموظف", "err");
        const o = s || { id: Store.uid("st"), perms: { clients: 1, appointments: 1 } };
        Object.assign(o, {
          name, role: UI.$("#stRoleF").value, phone: UI.$("#stPhone").value.trim(),
          salary: parseInt(UI.$("#stSalary").value) || 0, active: UI.$("#stActive").checked
        });
        if (!s) Store.get().staff.push(o);
        Store.log(`${editing ? "عدّل" : "أضاف"} موظفاً: ${name}`);
        Store.save(); UI.closeModal(); render(); App.refreshSidebar();
        UI.toast(editing ? "تم الحفظ ✓" : "أُضيف الموظف ✓");
      }
    });
  }

  /* ---------- الصلاحيات ---------- */
  function perms(s) {
    if (!s) return;
    UI.modal({
      title: `صلاحيات — ${s.name}`,
      body: `<p class="muted" style="margin-top:0">حدّد ما يستطيع هذا الموظف الوصول إليه داخل النظام.</p>
        <div class="perms">${Object.entries(PERMS).map(([k, lbl]) => `
          <label class="perm"><input type="checkbox" class="check" data-perm="${k}" ${s.perms && s.perms[k] ? "checked" : ""}> ${lbl}</label>`).join("")}</div>`,
      saveText: "حفظ الصلاحيات",
      onSave() {
        s.perms = s.perms || {};
        UI.$$("[data-perm]", UI.$("#modalBody")).forEach(cb => { s.perms[cb.dataset.perm] = cb.checked ? 1 : 0; });
        Store.log(`عدّل صلاحيات: ${s.name}`);
        Store.save(); UI.closeModal(); render();
        UI.toast("حُفظت الصلاحيات ✓");
      }
    });
  }

  /* ---------- ملف الموظف ---------- */
  function open(id) {
    const s = Store.getStaff(id); if (!s) return;
    const st = Store.get();
    const month = Store.rangeThisMonth();
    const mine = st.appointments.filter(a => a.sid === id).sort((a, b) => b.start - a.start);
    const done = mine.filter(a => a.status === "done");
    const revenue = done.reduce((t, a) => t + a.price, 0);
    const att = st.attendance.filter(a => a.sid === id).sort((a, b) => b.d - a.d).slice(0, 10);
    const avg = done.length ? Math.round(revenue / done.length) : 0;

    UI.drawer(`<div style="display:flex;gap:10px;align-items:center">
        <div class="avatar ${UI.grad(s.id)}">${UI.esc(UI.initials(s.name))}</div>
        <div><h3>${UI.esc(s.name)}</h3><div class="en">${(ROLES[s.role] || {}).ar}</div></div></div>`,
      `
      <div class="cards" style="grid-template-columns:repeat(2,1fr)">
        <div class="card" data-ico="✅"><div class="k">مواعيد منجزة</div><div class="v">${done.length}</div></div>
        <div class="card i3" data-ico="💰"><div class="k">الإيراد المُنجز</div><div class="v" style="font-size:17px">${UI.money(revenue)}</div></div>
      </div>
      <div class="kv"><span>الهاتف</span><b class="num">${UI.esc(s.phone || "—")}</b></div>
      <div class="kv"><span>الراتب</span><b class="money">${UI.money(s.salary || 0)}</b></div>
      <div class="kv"><span>متوسط قيمة الجلسة</span><b class="money">${UI.money(avg)}</b></div>
      <div class="kv"><span>الحالة</span><b>${s.active ? "🟢 نشط" : "⏸ غير نشط"}</b></div>

      <div class="sect-title">آخر المواعيد</div>
      ${mine.slice(0, 8).map(a => `<div class="ex-row" style="grid-template-columns:1fr auto auto">
        <div><b>${UI.esc((Store.getClient(a.cid) || {}).name || "—")}</b>
          <div class="en">${UI.fmtDate(a.start)} · ${UI.fmtTime(a.start)}</div></div>
        <span class="money">${UI.money(a.price)}</span>${UI.st(a.status)}</div>`).join("")
        || `<p class="muted" style="margin:0">لا توجد مواعيد.</p>`}

      <div class="sect-title">سجل الحضور</div>
      ${att.map(a => `<div class="kv"><span>${UI.fmtDate(a.d)}</span>
        <b>${UI.fmtTime(a.in)} → ${a.out ? UI.fmtTime(a.out) : "—"}</b></div>`).join("")
        || `<p class="muted" style="margin:0">لا يوجد سجل حضور.</p>`}

      <div class="form-actions" style="margin-top:16px">
        <button class="btn btn-soft" onclick="App.closeDrawer();Employees.form(Store.getStaff('${id}'))">✏️ تعديل</button>
        <button class="btn btn-soft" onclick="App.closeDrawer();Employees.perms(Store.getStaff('${id}'))">🔐 الصلاحيات</button>
      </div>
      <div class="form-actions">
        <button class="btn btn-danger" onclick="Employees.remove('${id}')">🗑️ حذف</button>
      </div>`);
  }

  function remove(id) {
    const s = Store.getStaff(id); if (!s) return;
    const used = Store.get().appointments.filter(a => a.sid === id).length;
    UI.confirm(used
      ? `لدى <b>${UI.esc(s.name)}</b> ${used} حجز مرتبط. الحذف سيبقي السجلات مع إزالة الموظف. متابعة؟`
      : `حذف الموظف <b>${UI.esc(s.name)}</b>؟`, () => {
      const st = Store.get();
      st.staff = st.staff.filter(x => x.id !== id);
      st.attendance = st.attendance.filter(a => a.sid !== id);
      st.appointments.forEach(a => { if (a.sid === id) a.sid = null; });
      Store.log(`حذف موظف: ${s.name}`);
      Store.save(); App.closeDrawer(); render(); App.refreshSidebar();
      UI.toast("تم الحذف", "warn");
    });
  }

  function printList() {
    const st = Store.get();
    const rows = st.staff.map(s => {
      const done = st.appointments.filter(a => a.sid === s.id && a.status === "done");
      return `<tr><td>${UI.esc(s.name)}</td><td>${(ROLES[s.role] || {}).ar}</td>
        <td>${UI.esc(s.phone || "—")}</td><td>${done.length}</td>
        <td>${UI.money(done.reduce((t, a) => t + a.price, 0))}</td>
        <td>${UI.money(s.salary || 0)}</td></tr>`;
    }).join("");
    UI.print(`${UI.printHead("قائمة موظفي المركز", "Staff list")}
      <table><thead><tr><th>الاسم</th><th>المسمى</th><th>الهاتف</th><th>جلسات منجزة</th><th>الإيراد المُنجز</th><th>الراتب</th></tr></thead>
      <tbody>${rows}</tbody></table>${UI.printFooter()}`);
  }

  return { init, render, form, perms, open, remove, checkInModal, printList };
})();
