/* =========================================================
   BeautiQ — عرض العملاء (CRM + نقاط الولاء)
   ========================================================= */
const Clients = (() => {
  const f = { q: "", src: "" };

  function init() {
    UI.$("#btnAddClient").addEventListener("click", () => form());
    UI.$("#clientSearch").addEventListener("input", e => { f.q = e.target.value.trim(); render(); });
    UI.$("#clientSource").addEventListener("change", e => { f.src = e.target.value; render(); });
    const s = UI.$("#clientSource");
    Object.entries(CLIENT_SOURCES).forEach(([k, v]) =>
      s.insertAdjacentHTML("beforeend", `<option value="${k}">${v.ar}</option>`));
  }

  function render() {
    let list = Store.get().clients.slice();
    if (f.src) list = list.filter(c => c.src === f.src);
    if (f.q) list = list.filter(c => (c.name + " " + (c.phone || "")).toLowerCase().includes(f.q.toLowerCase()));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const all = Store.get().clients;
    const totalSpent = all.reduce((t, c) => t + Store.clientStats(c.id).spent, 0);
    UI.$("#clientStats").innerHTML = `
      <div class="card" data-ico="👥"><div class="k">إجمالي العملاء</div><div class="v">${all.length}</div>
        <div class="s">${list.length} في النتائج الحالية</div></div>
      <div class="card i2" data-ico="⭐"><div class="k">نقاط الولاء الممنوحة</div><div class="v">${UI.num(all.reduce((t, c) => t + (c.points || 0), 0))}</div>
        <div class="s">قيمتها ${UI.money(all.reduce((t, c) => t + (c.points || 0), 0) * Store.get().settings.pointValue)}</div></div>
      <div class="card i3" data-ico="💳"><div class="k">إجمالي إنفاق العملاء</div><div class="v" style="font-size:17px">${UI.money(totalSpent)}</div>
        <div class="s">عبر ${Store.get().invoices.length} فاتورة</div></div>
      <div class="card i4" data-ico="🙋"><div class="k">عملاء نشطون هذا الشهر</div><div class="v">${new Set(Store.get().appointments
        .filter(a => a.status === "done" && Store.inRange(a.date || a.start, ...Object.values(Store.rangeThisMonth())))
        .map(a => a.cid)).size}</div>
        <div class="s">زاروا المركز خلال الشهر</div></div>`;

    if (!list.length) {
      UI.$("#clientGrid").innerHTML = UI.empty("👥", "لا يوجد عملاء",
        "أضف أول عميل لبدء إدارة ملفاته وولائه",
        `<button class="btn btn-primary" onclick="document.getElementById('btnAddClient').click()">+ عميل جديد</button>`);
      return;
    }

    UI.$("#clientGrid").innerHTML = list.map(c => {
      const s = Store.clientStats(c.id);
      const next = Store.get().appointments
        .filter(a => a.cid === c.id && a.status !== "cancel" && a.status !== "done" && a.start > Date.now())
        .sort((a, b) => a.start - b.start)[0];
      return `<article class="item">
        <div class="item-hd">
          <div style="display:flex;gap:10px;align-items:center">
            <div class="avatar ${UI.grad(c.id)}">${UI.esc(UI.initials(c.name))}</div>
            <div><h3>${UI.esc(c.name)}</h3><div class="en">${UI.esc(c.phone || "بدون هاتف")}</div></div>
          </div>
          <button class="btn btn-sm btn-ghost" data-open="${c.id}" title="التفاصيل">⋯</button>
        </div>
        <div class="item-bd">
          <div>${UI.tag((CLIENT_SOURCES[c.src] || { ar: "عميل" }).ar, "mus")}
            ${UI.tag("⭐ " + (c.points || 0) + " نقطة", "warn")}</div>
          <div class="kv" style="margin-top:8px"><span>عدد الزيارات</span><b>${s.visits}</b></div>
          <div class="kv"><span>إجمالي الإنفاق</span><b class="money">${UI.money(s.spent)}</b></div>
          <div class="kv"><span>آخر زيارة</span><b>${s.last ? UI.fmtDate(s.last) : "—"}</b></div>
          <div class="kv"><span>موعد قادم</span>
            <b style="color:${next ? "var(--brand2)" : "var(--muted)"}">${next ? UI.fmtDate(next.start) + " " + UI.fmtTime(next.start) : "لا يوجد"}</b></div>
        </div>
        <div class="item-ft">
          <button class="btn btn-sm btn-ghost" data-print="${c.id}">🖨️</button>
          <button class="btn btn-sm btn-ghost" data-edit="${c.id}">✏️</button>
          <button class="btn btn-sm btn-primary" data-open="${c.id}">الملف الكامل</button>
        </div>
      </article>`;
    }).join("");

    UI.$("#clientGrid").onclick = ev => {
      const t = ev.target.closest("button"); if (!t) return;
      if (t.dataset.open) open(t.dataset.open);
      if (t.dataset.edit) form(Store.getClient(t.dataset.edit));
      if (t.dataset.print) report(t.dataset.print);
    };
  }

  /* ---------- نموذج العميل ---------- */
  function form(c) {
    const editing = !!c;
    UI.modal({
      title: editing ? "تعديل بيانات العميل" : "إضافة عميل جديد",
      body: `<div class="form-grid">
        <label>الاسم الكامل *<input type="text" id="clName" value="${UI.esc(c ? c.name : "")}" placeholder="مثال: هدى عبد الرزاق"></label>
        <label>رقم الهاتف<input type="tel" id="clPhone" value="${UI.esc(c ? c.phone || "" : "")}" placeholder="07XX XXX XXXX"></label>
        <label>الجنس<select id="clGender">
          <option value="f" ${c && c.gender === "f" ? "selected" : ""}>أنثى</option>
          <option value="m" ${c && c.gender === "m" ? "selected" : ""}>ذكر</option></select></label>
        <label>تاريخ الميلاد<input type="date" id="clBirth" value="${UI.esc(c ? c.birthday || "" : "")}"></label>
        <label>مصدر العميل<select id="clSrc">${Object.entries(CLIENT_SOURCES).map(([k, v]) =>
          `<option value="${k}" ${c && c.src === k ? "selected" : ""}>${v.ar}</option>`).join("")}</select></label>
        <label>نقاط الولاء<input type="number" id="clPoints" value="${c ? c.points || 0 : 0}" min="0"></label>
      </div>
      <label style="margin-top:12px">ملاحظات طبية / عناية / Notes<textarea id="clNotes" rows="3">${UI.esc(c ? c.notes || "" : "")}</textarea></label>`,
      saveText: editing ? "حفظ التعديلات" : "إضافة العميل",
      onSave() {
        const name = UI.$("#clName").value.trim();
        if (!name) return UI.toast("أدخل اسم العميل", "err");
        const obj = c || { id: Store.uid("cl"), createdAt: Date.now() };
        obj.name = name;
        obj.phone = UI.$("#clPhone").value.trim();
        obj.gender = UI.$("#clGender").value;
        obj.birthday = UI.$("#clBirth").value;
        obj.src = UI.$("#clSrc").value;
        obj.points = Math.max(0, parseInt(UI.$("#clPoints").value) || 0);
        obj.notes = UI.$("#clNotes").value.trim();
        if (!c) Store.get().clients.push(obj);
        Store.log(`${editing ? "عدّل" : "أضاف"} عميلاً: ${name}`);
        Store.save(); UI.closeModal(); render(); App.refreshSidebar();
        UI.toast(editing ? "تم الحفظ ✓" : "أُضيف العميل ✓");
        if (!c) open(obj.id);
      }
    });
  }

  /* ---------- الملف الكامل ---------- */
  function open(id) {
    const c = Store.getClient(id); if (!c) return;
    const s = Store.clientStats(id);
    const st = Store.get();
    const upcoming = s.appts.filter(a => a.status !== "cancel" && a.status !== "done" && a.start > Date.now())
      .sort((a, b) => a.start - b.start);
    const past = s.appts.filter(a => a.start <= Date.now() || a.status === "done" || a.status === "cancel")
      .sort((a, b) => b.start - a.start).slice(0, 8);

    UI.drawer(`<div style="display:flex;gap:10px;align-items:center">
        <div class="avatar ${UI.grad(c.id)}">${UI.esc(UI.initials(c.name))}</div>
        <div><h3>${UI.esc(c.name)}</h3><div class="en">${UI.esc(c.phone || "")}</div></div></div>`,
      `
      <div class="cards" style="grid-template-columns:repeat(2,1fr)">
        <div class="card" data-ico="🔁"><div class="k">الزيارات</div><div class="v">${s.visits}</div></div>
        <div class="card i3" data-ico="💰"><div class="k">الإنفاق</div><div class="v" style="font-size:17px">${UI.money(s.spent)}</div></div>
      </div>

      <div class="pill-row">
        ${UI.tag("⭐ " + (c.points || 0) + " نقطة = " + UI.money((c.points || 0) * st.settings.pointValue), "warn")}
        ${UI.tag((CLIENT_SOURCES[c.src] || {}).ar || "—", "mus")}
        ${c.birthday ? UI.tag("🎂 " + c.birthday, "info") : ""}
        ${UI.tag("عميل منذ " + UI.fmtDate(c.createdAt), "")}
      </div>

      ${c.notes ? `<div class="sect-title">ملاحظات</div><p style="font-size:13.5px;line-height:1.7;margin:0">${UI.esc(c.notes)}</p>` : ""}

      <div class="sect-title">مواعيد قادمة (${upcoming.length})</div>
      ${upcoming.length ? upcoming.map(a => `
        <div class="ex-row" style="grid-template-columns:1fr auto">
          <div><b>${UI.esc(a.items.map(i => i.name).join(" + "))}</b>
            <div class="en">${UI.fmtDate(a.start)} · ${UI.fmtTime(a.start)} · ${UI.esc((Store.getStaff(a.sid) || {}).name || "بدون موظف")}</div></div>
          ${UI.st(a.status)}
        </div>`).join("") : `<p class="muted" style="margin:0">لا توجد مواعيد قادمة.</p>`}

      <div class="sect-title">سجل الزيارات (${s.appts.length})</div>
      ${past.length ? past.map(a => `
        <div class="ex-row" style="grid-template-columns:1fr auto auto">
          <div><b>${UI.esc(a.items.map(i => i.name).join(" + "))}</b>
            <div class="en">${UI.fmtDate(a.start)} · ${UI.fmtTime(a.start)}</div></div>
          <span class="money">${UI.money(a.price)}</span>${UI.st(a.status)}
        </div>`).join("") : `<p class="muted" style="margin:0">لا توجد زيارات سابقة.</p>`}

      <div class="sect-title">الفواتير (${s.invoices.length})</div>
      ${s.invoices.length ? s.invoices.slice().sort((a, b) => b.date - a.date).map(i => `
        <div class="ex-row" style="grid-template-columns:1fr auto auto">
          <div><b>${i.no}</b><div class="en">${UI.fmtDate(i.date)} · ${(PAY_METHODS[i.method] || {}).ar}</div></div>
          <span class="money">${UI.money(i.total)}</span>
          <button class="btn btn-sm btn-ghost" onclick="Finance.viewInvoice('${i.id}')">عرض</button>
        </div>`).join("") : `<p class="muted" style="margin:0">لا توجد فواتير.</p>`}

      <div class="form-actions" style="margin-top:18px">
        <button class="btn btn-soft" onclick="App.closeDrawer();Clients.form(Store.getClient('${c.id}'))">✏️ تعديل</button>
        <button class="btn btn-soft" onclick="Appointments.quick('${c.id}')">📅 حجز موعد</button>
        <button class="btn btn-primary" onclick="Finance.newInvoice('${c.id}')">🧾 فاتورة جديدة</button>
      </div>
      <div class="form-actions">
        <button class="btn btn-danger" onclick="Clients.remove('${c.id}')">🗑️ حذف العميل</button>
      </div>`);
  }

  function remove(id) {
    const c = Store.getClient(id); if (!c) return;
    UI.confirm(`سيتم حذف <b>${UI.esc(c.name)}</b> ومواعيده وفواتيره نهائياً. هل أنت متأكد؟`, () => {
      const st = Store.get();
      st.clients = st.clients.filter(x => x.id !== id);
      st.appointments = st.appointments.filter(a => a.cid !== id);
      st.invoices = st.invoices.filter(i => i.cid !== id);
      Store.log(`حذف العميل: ${c.name}`);
      Store.save(); App.closeDrawer(); render(); App.refreshSidebar();
      UI.toast("تم حذف العميل", "warn");
    });
  }

  /* ---------- نقاط الولاء ---------- */
  function addPoints(cid, n, reason) {
    const c = Store.getClient(cid); if (!c) return;
    c.points = Math.max(0, (c.points || 0) + n);
    if (reason) Store.log(`${reason} — ${c.name} (${n > 0 ? "+" : ""}${n} نقطة)`);
    Store.save();
  }

  function redeem(id) {
    const c = Store.getClient(id); if (!c) return;
    const st = Store.get();
    const max = c.points || 0;
    if (!max) return UI.toast("لا توجد نقاط كافية", "err");
    UI.modal({
      title: "استبدال نقاط الولاء",
      body: `<p class="muted" style="margin-top:0">لدي <b>${max}</b> نقطة لدى ${UI.esc(c.name)} —
        قيمة النقطة ${UI.money(st.settings.pointValue)}. الاستبدال يخصم من الفاتورة القادمة كخصم يدوي.</p>
        <div class="form-grid">
          <label>عدد النقاط للاستبدال<input type="number" id="rdPts" min="1" max="${max}" value="${Math.min(max, 10)}"></label>
          <label>القيمة بالدينار<input type="text" id="rdVal" readonly value="${UI.money(0)}"></label>
        </div>`,
      saveText: "خصم النقاط",
      onSave() {
        const pts = Math.min(max, Math.max(1, parseInt(UI.$("#rdPts").value) || 0));
        c.points -= pts;
        Store.log(`استبدل ${c.name} ${pts} نقطة`);
        Store.save(); UI.closeModal(); render(); open(id);
        UI.toast(`تم خصم ${pts} نقطة — استخدمها كخصم في الفاتورة ✓`);
      }
    });
    const upd = () => {
      const pts = Math.min(max, Math.max(1, parseInt(UI.$("#rdPts").value) || 0));
      UI.$("#rdVal").value = UI.money(pts * st.settings.pointValue);
    };
    UI.$("#rdPts").addEventListener("input", upd); upd();
  }

  /* ---------- طباعة ملف العميل ---------- */
  function report(id) {
    const c = Store.getClient(id); if (!c) return;
    const s = Store.clientStats(id), st = Store.get();
    const rows = s.appts.slice().sort((a, b) => b.start - a.start).map(a => `
      <tr><td>${UI.fmtDate(a.start)}</td><td>${UI.fmtTime(a.start)}</td>
      <td>${UI.esc(a.items.map(i => i.name).join(" + "))}</td>
      <td>${UI.esc((Store.getStaff(a.sid) || {}).name || "—")}</td>
      <td>${(APPT_STATUS[a.status] || {}).ar}</td><td>${UI.money(a.price)}</td></tr>`).join("");
    UI.print(`${UI.printHead("ملف العميل", c.name)}
      <div class="p-grid">
        <div class="p-box">الاسم: <b>${UI.esc(c.name)}</b><br>الهاتف: ${UI.esc(c.phone || "—")}<br>
          المصدر: ${(CLIENT_SOURCES[c.src] || {}).ar || "—"}<br>عميل منذ: ${UI.fmtDate(c.createdAt)}</div>
        <div class="p-box">الزيارات: <b>${s.visits}</b><br>الإنفاق الكلي: <b>${UI.money(s.spent)}</b><br>
          نقاط الولاء: <b>${c.points || 0}</b> (${UI.money((c.points || 0) * st.settings.pointValue)})</div>
      </div>
      ${c.notes ? `<p><b>ملاحظات:</b> ${UI.esc(c.notes)}</p>` : ""}
      <h3>سجل الزيارات والمواعيد</h3>
      <table><thead><tr><th>التاريخ</th><th>الوقت</th><th>الخدمة</th><th>الموظف</th><th>الحالة</th><th>المبلغ</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6">لا توجد زيارات</td></tr>`}</tbody></table>
      ${UI.printFooter()}`);
  }

  return { init, render, form, open, remove, report, addPoints, redeem };
})();
