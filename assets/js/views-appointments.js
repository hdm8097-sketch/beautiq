/* =========================================================
   BeautiQ — المواعيد والحجوزات (تقويم + خط زمني + تذكيرات)
   ========================================================= */
const Appointments = (() => {
  const f = { view: "day", staff: "" };
  let cursor = new Date(); cursor.setHours(0, 0, 0, 0);   /* اليوم المعروض */
  let calMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const H0 = 9, H1 = 21;   /* ساعات العمل */

  function init() {
    UI.$("#btnAddAppt").addEventListener("click", () => form());
    UI.$("#apptStaff").addEventListener("change", e => { f.staff = e.target.value; render(); });
    UI.$$("#apptTabs .tab").forEach(t => t.onclick = () => {
      f.view = t.dataset.tab;
      UI.$$("#apptTabs .tab").forEach(x => x.classList.toggle("active", x === t));
      render();
    });
    UI.$("#btnPrev").onclick = () => shift(-1);
    UI.$("#btnNext").onclick = () => shift(1);
    UI.$("#btnToday").onclick = () => { cursor = new Date(); cursor.setHours(0, 0, 0, 0);
      calMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1); render(); };
    UI.$("#btnPrintDay").onclick = printDay;
    remind();
  }

  function shift(dir) {
    if (f.view === "month") calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + dir, 1);
    else { cursor.setDate(cursor.getDate() + dir); calMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1); }
    render();
  }

  function fillStaff() {
    const s = UI.$("#apptStaff");
    if (s.dataset.filled) return;
    s.insertAdjacentHTML("afterbegin", `<option value="">كل الموظفين</option>` +
      Store.get().staff.map(x => `<option value="${x.id}">${UI.esc(x.name)}</option>`).join(""));
    s.dataset.filled = "1";
  }

  const list = () => Store.get().appointments
    .filter(a => !f.staff || a.sid === f.staff)
    .sort((a, b) => a.start - b.start);

  function render() {
    fillStaff();
    const all = list();
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const t0 = today0.getTime(), t1 = t0 + 86400000;
    const todays = all.filter(a => a.start >= t0 && a.start < t1);
    const doneToday = todays.filter(a => a.status === "done").length;
    const month = all.filter(a => Store.inRange(a.start, ...Object.values(Store.rangeThisMonth())));

    UI.$("#apptStats").innerHTML = `
      <div class="card" data-ico="📅"><div class="k">مواعيد اليوم</div><div class="v">${todays.length}</div>
        <div class="s">${doneToday} منجز · ${todays.filter(a => a.status === "booked").length} مؤكد</div></div>
      <div class="card i2" data-ico="💲"><div class="k">إيراد اليوم المتوقع</div><div class="v" style="font-size:17px">${UI.money(todays.filter(a => a.status !== "cancel").reduce((t, a) => t + a.price, 0))}</div>
        <div class="s">من ${todays.filter(a => a.status !== "cancel").length} موعد</div></div>
      <div class="card i3" data-ico="🗓"><div class="k">مواعيد الشهر</div><div class="v">${month.length}</div>
        <div class="s">${month.filter(a => a.status === "cancel").length} ملغي</div></div>
      <div class="card i4" data-ico="🧮"><div class="k">متوسط قيمة الموعد</div><div class="v" style="font-size:17px">${UI.money(month.filter(a => a.status !== "cancel").length ? Math.round(month.filter(a => a.status !== "cancel").reduce((t, a) => t + a.price, 0) / month.filter(a => a.status !== "cancel").length) : 0)}</div>
        <div class="s">خلال الشهر الحالي</div></div>`;

    UI.$("#apptNavLabel").textContent = f.view === "month"
      ? `${UI.monthAr(calMonth.getMonth())} ${calMonth.getFullYear()}`
      : UI.fmtDay(cursor.getTime());

    if (f.view === "month") renderMonth(); else renderDay();
  }

  /* ================= العرض الشهري ================= */
  function renderMonth() {
    const dows = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const first = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    const evs = list();
    let cells = "";
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      const dayEv = evs.filter(a => UI.dayKey(a.start) === k);
      const isToday = k === UI.today();
      const out = d.getMonth() !== calMonth.getMonth();
      cells += `<div class="cal-cell ${out ? "out" : ""} ${isToday ? "today" : ""}" data-date="${k}">
        <span class="dnum">${d.getDate()}</span>
        ${dayEv.slice(0, 3).map(a => `<span class="cal-ev ${a.status}" data-appt="${a.id}" title="${UI.esc(a.items.map(x => x.name).join(" + "))}">
          ${UI.fmtTime(a.start).slice(0, 5)} ${UI.esc(a.items[0] ? a.items[0].name : "")}</span>`).join("")}
        ${dayEv.length > 3 ? `<span class="cal-more">+${dayEv.length - 3} أخرى</span>` : ""}
      </div>`;
    }
    UI.$("#apptBody").innerHTML = `<div class="cal">
      <div class="cal-grid">${dows.map(x => `<div class="cal-dow">${x}</div>`).join("")}</div>
      <div class="cal-grid">${cells}</div></div>`;

    UI.$("#apptBody").onclick = ev => {
      const e = ev.target.closest("[data-appt]");
      if (e) { ev.stopPropagation(); return detail(e.dataset.appt); }
      const c = ev.target.closest("[data-date]");
      if (c) form(null, c.dataset.date);
    };
  }

  /* ================= العرض اليومي ================= */
  function renderDay() {
    const k = UI.dayKey(cursor.getTime());
    const dayAppts = list().filter(a => UI.dayKey(a.start) === k);
    let rows = "";
    for (let h = H0; h < H1; h++) {
      const hourAppts = dayAppts.filter(a => new Date(a.start).getHours() === h);
      const inner = hourAppts.map(a => `
        <div class="tl-appt ${a.status}" data-appt="${a.id}">
          <b>${UI.fmtTime(a.start).slice(0, 5)}</b> · ${UI.esc(a.items.map(x => x.name).join(" + "))}
          <div class="sub">${UI.esc(a.clientName || (Store.getClient(a.cid) || {}).name || "—")}
            · ${UI.esc((Store.getStaff(a.sid) || {}).name || "بدون موظف")} · <span class="money">${UI.money(a.price)}</span> ${UI.st(a.status)}</div>
        </div>`).join("");
      rows += `<div class="tl-row">
        <div class="tl-h">${String(h).padStart(2, "0")}:00</div>
        <div class="tl-slot" data-hour="${h}">${inner}</div>
      </div>`;
    }
    const none = !dayAppts.length;
    UI.$("#apptBody").innerHTML = `
      ${none ? `<p class="muted" style="margin-top:0">لا توجد مواعيد في هذا اليوم — اضغط على أي فراغ لإضافة حجز.</p>` : ""}
      <div class="tl">${rows}</div>`;

    UI.$("#apptBody").onclick = ev => {
      const e = ev.target.closest("[data-appt]");
      if (e) return detail(e.dataset.appt);
      const s = ev.target.closest("[data-hour]");
      if (s) form(null, k, parseInt(s.dataset.hour));
    };
  }

  /* ================= نموذج الحجز ================= */
  function form(a, dateK, hour) {
    const editing = !!a, st = Store.get();
    const d = dateK || (editing ? UI.dayKey(a.start) : UI.today());
    const h = hour != null ? hour : (editing ? new Date(a.start).getHours() : Math.min(18, new Date().getHours() + 1));
    const m = editing ? new Date(a.start).getMinutes() : 0;
    const sel = new Set(editing ? a.items.map(i => i.ref) : []);

    const svLines = () => st.services.filter(s => sel.has(s.id)).map(s => {
      const cur = (editing && a.items.find(i => i.ref === s.id)) || null;
      return `<div class="pos-line">
        <div class="p-name">${UI.esc(s.name)} <span class="muted">· ${s.dur} د</span></div>
        <input type="number" min="0" step="1000" value="${cur ? cur.price : s.price}" data-price="${s.id}">
        <div class="money" style="text-align:center">${UI.money(cur ? cur.price : s.price)}</div>
        <button class="pos-rm" data-un="${s.id}">✕</button></div>`;
    }).join("");

    UI.modal({
      wide: true,
      title: editing ? "تعديل الحجز" : "حجز موعد جديد",
      body: `<div class="form-grid">
        <label>العميل *<select id="apClient">
          <option value="">— اختر العميل —</option>
          ${st.clients.map(c => `<option value="${c.id}" ${editing && a.cid === c.id ? "selected" : ""}>${UI.esc(c.name)} — ${UI.esc(c.phone || "")}</option>`).join("")}
        </select></label>
        <label>الموظف المسؤول<select id="apStaff">
          <option value="">بدون موظف</option>
          ${st.staff.filter(x => x.active).map(x => `<option value="${x.id}" ${editing && a.sid === x.id ? "selected" : ""}>${UI.esc(x.name)} · ${(ROLES[x.role] || {}).ar}</option>`).join("")}
        </select></label>
        <label>التاريخ<input type="date" id="apDate" value="${d}"></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label>الوقت<input type="time" id="apTime" value="${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}"></label>
          <label>المدة (دقيقة)<input type="number" id="apDur" min="15" step="15" value="${editing ? a.dur : 60}"></label>
        </div>
        <label>الحالة<select id="apStatus">${Object.entries(APPT_STATUS).map(([k, v]) =>
          `<option value="${k}" ${editing && a.status === k ? "selected" : ""}>${v.ar}</option>`).join("")}</select></label>
        <label>قيمة الحجز (د.ع)<input type="number" id="apPrice" value="${editing ? a.price : 0}" min="0" step="1000"></label>
      </div>

      <div class="divider-lbl">الخدمات المختارة</div>
      <div id="apSvLines">${svLines() || `<p class="muted" style="margin:0">لم تختر خدمة بعد — اختر من القائمة بالأسفل.</p>`}</div>
      <div class="pos-add">
        <select id="apSvAdd"><option value="">＋ إضافة خدمة…</option>
          ${st.services.filter(s => s.active && !sel.has(s.id)).map(s =>
            `<option value="${s.id}">${UI.esc(s.name)} — ${UI.money(s.price)} (${s.dur} د)</option>`).join("")}
        </select>
        <button class="btn btn-soft" id="apSvBtn">إضافة</button>
        <button class="btn btn-ghost" id="apSvClear">تفريغ</button>
      </div>

      <label style="margin-top:12px">ملاحظات<textarea id="apNotes" rows="2">${UI.esc(editing ? a.notes || "" : "")}</textarea></label>`,
      saveText: editing ? "حفظ الحجز" : "تأكيد الحجز",
      onSave() {
        const cid = UI.$("#apClient").value;
        if (!cid) return UI.toast("اختر العميل", "err");
        const date = UI.$("#apDate").value, time = UI.$("#apTime").value;
        if (!date || !time) return UI.toast("حدد التاريخ والوقت", "err");
        const start = new Date(date + "T" + time).getTime();
        const items = [...sel].map(id => {
          const s = Store.getService(id);
          const pin = UI.$(`[data-price="${id}"]`);
          return { ref: id, name: s.name, price: parseInt(pin && pin.value) || s.price };
        });
        const obj = editing || { id: Store.uid("ap"), invoiceId: null };
        obj.cid = cid; obj.sid = UI.$("#apStaff").value || null;
        obj.start = start; obj.dur = parseInt(UI.$("#apDur").value) || 60;
        obj.status = UI.$("#apStatus").value;
        obj.items = items;
        obj.price = parseInt(UI.$("#apPrice").value) || items.reduce((t, i) => t + i.price, 0);
        obj.notes = UI.$("#apNotes").value.trim();
        if (!editing) Store.get().appointments.push(obj);
        const cn = (Store.getClient(cid) || {}).name;
        Store.log(`${editing ? "عدّل" : "حجز"} موعد ${cn} — ${UI.fmtDate(start)} ${UI.fmtTime(start)}`);
        Store.save(); UI.closeModal(); render(); App.refreshSidebar();
        UI.toast(editing ? "تم حفظ الحجز ✓" : "تم تأكيد الحجز ✓ — سيظهر في التذكيرات");
      }
    });

    /* تفاعل اختيار الخدمات */
    const refreshLines = () => {
      UI.$("#apSvLines").innerHTML = svLines() ||
        `<p class="muted" style="margin:0">لم تختر خدمة بعد — اختر من القائمة بالأسفل.</p>`;
      const sel2 = UI.$("#apSvAdd");
      sel2.innerHTML = `<option value="">＋ إضافة خدمة…</option>` +
        st.services.filter(s => s.active && !sel.has(s.id)).map(s =>
          `<option value="${s.id}">${UI.esc(s.name)} — ${UI.money(s.price)} (${s.dur} د)</option>`).join("");
      recalc();
    };
    const recalc = () => {
      const total = [...sel].reduce((t, id) => {
        const pin = UI.$(`[data-price="${id}"]`);
        return t + (parseInt(pin && pin.value) || 0);
      }, 0);
      const dur = [...sel].reduce((t, id) => t + (Store.getService(id) || {}).dur || 0, 0);
      UI.$("#apPrice").value = total;
      if (dur) UI.$("#apDur").value = dur;
    };
    UI.$("#apSvBtn").onclick = () => {
      const v = UI.$("#apSvAdd").value; if (!v) return;
      sel.add(v); refreshLines();
    };
    UI.$("#apSvAdd").onchange = () => { const v = UI.$("#apSvAdd").value; if (v) { sel.add(v); refreshLines(); } };
    UI.$("#apSvClear").onclick = () => { sel.clear(); refreshLines(); };
    UI.$("#apSvLines").onclick = ev => {
      const b = ev.target.closest("[data-un]"); if (!b) return;
      sel.delete(b.dataset.un); refreshLines();
    };
    UI.$("#apSvLines").addEventListener("input", () => {
      const total = [...sel].reduce((t, id) => {
        const pin = UI.$(`[data-price="${id}"]`);
        return t + (parseInt(pin && pin.value) || 0);
      }, 0);
      UI.$("#apPrice").value = total;
    });
    refreshLines();
  }

  /* حجز سريع لعميل معيّن */
  function quick(cid) {
    App.closeDrawer(); App.go("appointments");
    setTimeout(() => {
      form(null, UI.today(), 12);
      const s = UI.$("#apClient"); if (s) s.value = cid;
    }, 200);
  }

  /* ================= تفاصيل الحجز ================= */
  function detail(id) {
    const a = Store.getAppt(id); if (!a) return;
    const c = Store.getClient(a.cid), s = Store.getStaff(a.sid);
    const inv = a.invoiceId ? Store.getInvoice(a.invoiceId) : null;
    UI.modal({
      hideSave: true,
      title: "تفاصيل الحجز",
      body: `
        <div class="pill-row" style="margin-bottom:10px">${UI.st(a.status)}
          ${UI.tag(UI.fmtDate(a.start) + " · " + UI.fmtTime(a.start), "mus")}
          ${UI.tag(a.dur + " دقيقة", "info")}</div>
        <div class="kv"><span>العميل</span><b>${UI.esc((c || {}).name || "—")}</b></div>
        <div class="kv"><span>الهاتف</span><b class="num">${UI.esc((c || {}).phone || "—")}</b></div>
        <div class="kv"><span>الموظف</span><b>${UI.esc((s || {}).name || "بدون موظف")}</b></div>
        <div class="kv"><span>الخدمات</span><b>${UI.esc(a.items.map(i => i.name).join(" + "))}</b></div>
        <div class="kv"><span>القيمة</span><b class="money">${UI.money(a.price)}</b></div>
        ${inv ? `<div class="kv"><span>الفاتورة</span><b>${inv.no} · ${UI.money(inv.total)}</b></div>` : ""}
        ${a.notes ? `<div class="sect-title">ملاحظات</div><p style="margin:0;font-size:13.5px">${UI.esc(a.notes)}</p>` : ""}
        <div class="form-actions" style="margin-top:14px">
          <button class="btn btn-soft" onclick="App.closeModal();Appointments.form(Store.getAppt('${id}'))">✏️ تعديل</button>
          ${a.status !== "done" && !inv ? `<button class="btn btn-primary" onclick="Appointments.complete('${id}')">✅ إنهاء وإنشاء فاتورة</button>` : ""}
        </div>
        <div class="form-actions">
          ${a.status === "booked" || a.status === "wait" ? `<button class="btn btn-soft" onclick="Appointments.setStatus('${id}','done')">✓ تم</button>
            <button class="btn btn-soft" onclick="Appointments.setStatus('${id}','cancel')">✕ إلغاء</button>` : ""}
          <button class="btn btn-danger" onclick="Appointments.remove('${id}')">🗑️ حذف</button>
        </div>`
    });
  }

  function setStatus(id, st2) {
    const a = Store.getAppt(id); if (!a) return;
    a.status = st2;
    Store.log(`حالة موعد ${Store.getClient(a.cid).name}: ${(APPT_STATUS[st2] || {}).ar}`);
    Store.save(); UI.closeModal(); render();
    UI.toast("تم تحديث الحالة ✓");
  }

  function complete(id) {
    const a = Store.getAppt(id); if (!a) return;
    a.status = "done";
    Store.save();
    UI.closeModal();
    render();
    setTimeout(() => Finance.invoiceFromAppt(id), 250);
  }

  function remove(id) {
    const a = Store.getAppt(id); if (!a) return;
    UI.confirm("حذف هذا الحجز نهائياً؟", () => {
      const st = Store.get();
      st.appointments = st.appointments.filter(x => x.id !== id);
      Store.log("حُذف حجز موعد");
      Store.save(); UI.closeModal(); render(); App.refreshSidebar();
      UI.toast("تم حذف الحجز", "warn");
    });
  }

  /* ================= تذكيرات ================= */
  function remind() {
    const now = Date.now();
    const todays = Store.get().appointments
      .filter(a => UI.dayKey(a.start) === UI.today() && a.status !== "cancel" && a.status !== "done");
    const soon = todays.filter(a => a.start >= now && a.start - now <= 3600000);
    setTimeout(() => {
      if (soon.length) UI.toast(`⏰ لديك ${soon.length} موعد خلال الساعة القادمة`, "warn");
      else if (todays.length) UI.toast(`📅 لديك ${todays.length} مواعيد اليوم`);
    }, 1200);
  }

  /* ================= طباعة جدول اليوم ================= */
  function printDay() {
    const k = UI.dayKey(cursor.getTime());
    const day = Store.get().appointments.filter(a => UI.dayKey(a.start) === k).sort((a, b) => a.start - b.start);
    const rows = day.map((a, i) => `<tr><td>${i + 1}</td><td>${UI.fmtTime(a.start)}</td>
      <td>${UI.esc((Store.getClient(a.cid) || {}).name || "—")}</td>
      <td>${UI.esc(a.items.map(x => x.name).join(" + "))}</td>
      <td>${UI.esc((Store.getStaff(a.sid) || {}).name || "—")}</td>
      <td>${(APPT_STATUS[a.status] || {}).ar}</td><td>${UI.money(a.price)}</td></tr>`).join("");
    UI.print(`${UI.printHead("جدول المواعيد اليومي", UI.fmtDay(new Date(k + "T00:00").getTime()))}
      <table><thead><tr><th>#</th><th>الوقت</th><th>العميل</th><th>الخدمة</th><th>الموظف</th><th>الحالة</th><th>المبلغ</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7">لا توجد مواعيد</td></tr>`}</tbody>
      <tfoot><tr><th colspan="6">الإجمالي المتوقع</th><th>${UI.money(day.filter(a => a.status !== "cancel").reduce((t, a) => t + a.price, 0))}</th></tr></tfoot></table>
      ${UI.printFooter()}`);
  }

  return { init, render, form, quick, detail, setStatus, complete, remove, printDay };
})();
