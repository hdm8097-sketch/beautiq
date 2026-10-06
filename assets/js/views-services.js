/* =========================================================
   BeautiQ — كتالوج الخدمات (الأسعار والمدد)
   ========================================================= */
const Services = (() => {
  const f = { q: "", cat: "" };

  function init() {
    UI.$("#btnAddService").addEventListener("click", () => form());
    UI.$("#svSearch").addEventListener("input", e => { f.q = e.target.value.trim(); render(); });
    UI.$("#svCat").addEventListener("change", e => { f.cat = e.target.value; render(); });
    UI.$("#btnPrintServices").addEventListener("click", printList);
    const s = UI.$("#svCat");
    Object.entries(SERVICE_CATS).forEach(([k, v]) =>
      s.insertAdjacentHTML("beforeend", `<option value="${k}">${v.ar}</option>`));
  }

  function render() {
    let list = Store.get().services.slice();
    if (f.cat) list = list.filter(s => s.cat === f.cat);
    if (f.q) list = list.filter(s => s.name.toLowerCase().includes(f.q.toLowerCase()));

    const all = Store.get().services;
    const cats = new Set(all.map(s => s.cat)).size;
    UI.$("#svStats").innerHTML = `
      <div class="card" data-ico="💆"><div class="k">عدد الخدمات</div><div class="v">${all.length}</div>
        <div class="s">${all.filter(s => s.active).length} نشطة</div></div>
      <div class="card i2" data-ico="🗂"><div class="k">التخصصات</div><div class="v">${cats}</div>
        <div class="s">في كتالوج المركز</div></div>
      <div class="card i3" data-ico="💲"><div class="k">متوسط السعر</div><div class="v" style="font-size:17px">${UI.money(all.length ? Math.round(all.reduce((t, s) => t + s.price, 0) / all.length) : 0)}</div>
        <div class="s">لكل خدمة</div></div>
      <div class="card i4" data-ico="⏱"><div class="k">متوسط المدة</div><div class="v">${all.length ? Math.round(all.reduce((t, s) => t + s.dur, 0) / all.length) : 0} د</div>
        <div class="s">وقت الجلسة</div></div>`;

    if (!list.length) {
      UI.$("#svGrid").innerHTML = UI.empty("💆", "لا توجد خدمات",
        "أضف خدماتك لعرضها في الحجوزات والفواتير",
        `<button class="btn btn-primary" onclick="document.getElementById('btnAddService').click()">+ خدمة جديدة</button>`);
      return;
    }

    UI.$("#svGrid").innerHTML = list.map(s => {
      const used = Store.get().appointments.filter(a => a.items.some(i => i.ref === s.id)).length;
      return `<article class="item">
        <div class="item-hd">
          <div style="display:flex;gap:10px;align-items:center">
            <div class="avatar ${UI.grad(s.id)}">${UI.esc(UI.initials(s.name))}</div>
            <div><h3>${UI.esc(s.name)}</h3><div class="en">${(SERVICE_CATS[s.cat] || {}).ar || ""}</div></div>
          </div>
          ${s.active ? UI.tag("نشطة", "ok") : UI.tag("موقوفة", "bad")}
        </div>
        <div class="item-bd">
          <div class="kv"><span>السعر</span><b class="money" style="color:var(--brand2)">${UI.money(s.price)}</b></div>
          <div class="kv"><span>مدة الجلسة</span><b>${s.dur} دقيقة</b></div>
          <div class="kv"><span>مرات الحجز</span><b>${used}</b></div>
          <div class="kv"><span>متوسط الإيراد منها</span><b class="money">${UI.money(used ? Math.round(Store.get().appointments
            .filter(a => a.items.some(i => i.ref === s.id)).reduce((t, a) => t + (a.items.find(i => i.ref === s.id).price), 0) / used) : 0)}</b></div>
        </div>
        <div class="item-ft">
          <button class="btn btn-sm btn-ghost" data-toggle="${s.id}">${s.active ? "⏸ إيقاف" : "▶ تشغيل"}</button>
          <button class="btn btn-sm btn-ghost" data-edit="${s.id}">✏️</button>
          <button class="btn btn-sm btn-danger" data-del="${s.id}">🗑️</button>
        </div>
      </article>`;
    }).join("");

    UI.$("#svGrid").onclick = ev => {
      const t = ev.target.closest("button"); if (!t) return;
      if (t.dataset.edit) form(Store.getService(t.dataset.edit));
      if (t.dataset.toggle) {
        const s2 = Store.getService(t.dataset.toggle);
        s2.active = !s2.active; Store.save(); render();
        UI.toast(s2.active ? "تم تفعيل الخدمة ✓" : "تم إيقاف الخدمة", "warn");
      }
      if (t.dataset.del) del(t.dataset.del);
    };
  }

  function form(s) {
    const editing = !!s;
    UI.modal({
      title: editing ? "تعديل الخدمة" : "إضافة خدمة جديدة",
      body: `<div class="form-grid">
        <label>اسم الخدمة *<input type="text" id="svName" value="${UI.esc(s ? s.name : "")}" placeholder="مثال: تنظيف عميق للوجه"></label>
        <label>التخصص<select id="svCatF">${Object.entries(SERVICE_CATS).map(([k, v]) =>
          `<option value="${k}" ${s && s.cat === k ? "selected" : ""}>${v.ar}</option>`).join("")}</select></label>
        <label>السعر (د.ع) *<input type="number" id="svPrice" value="${s ? s.price : ""}" min="0" step="1000"></label>
        <label>مدة الجلسة (دقيقة)<input type="number" id="svDur" value="${s ? s.dur : 60}" min="5" step="5"></label>
      </div>
      <label class="chk"><input type="checkbox" id="svActive" ${!s || s.active ? "checked" : ""}> الخدمة متاحة للحجز</label>`,
      saveText: editing ? "حفظ" : "إضافة",
      onSave() {
        const name = UI.$("#svName").value.trim();
        const price = parseInt(UI.$("#svPrice").value);
        if (!name) return UI.toast("أدخل اسم الخدمة", "err");
        if (!(price >= 0)) return UI.toast("أدخل سعراً صحيحاً", "err");
        const o = s || { id: Store.uid("sv") };
        Object.assign(o, {
          name, cat: UI.$("#svCatF").value, price,
          dur: parseInt(UI.$("#svDur").value) || 60,
          active: UI.$("#svActive").checked
        });
        if (!s) Store.get().services.push(o);
        Store.log(`${editing ? "عدّل" : "أضاف"} خدمة: ${name}`);
        Store.save(); UI.closeModal(); render();
        UI.toast(editing ? "تم الحفظ ✓" : "أُضيفت الخدمة ✓");
      }
    });
  }

  function del(id) {
    const s = Store.getService(id); if (!s) return;
    const used = Store.get().appointments.filter(a => a.items.some(i => i.ref === id)).length;
    UI.confirm(used
      ? `هذه الخدمة مستخدمة في <b>${used}</b> حجز/فاتورة. حذفها سيبقي السجلات لكنها ستختفي من الكتالوج. متابعة؟`
      : `حذف خدمة «${UI.esc(s.name)}» نهائياً؟`, () => {
      const st = Store.get();
      st.services = st.services.filter(x => x.id !== id);
      Store.log(`حذف خدمة: ${s.name}`);
      Store.save(); render(); UI.toast("تم الحذف", "warn");
    });
  }

  function printList() {
    const rows = Store.get().services.slice()
      .sort((a, b) => a.cat.localeCompare(b.cat))
      .map(s => `<tr><td>${UI.esc(s.name)}</td><td>${(SERVICE_CATS[s.cat] || {}).ar}</td>
        <td>${s.dur} د</td><td>${UI.money(s.price)}</td><td>${s.active ? "متاحة" : "موقوفة"}</td></tr>`).join("");
    UI.print(`${UI.printHead("قائمة أسعار الخدمات", "Price list")}
      <table><thead><tr><th>الخدمة</th><th>التخصص</th><th>المدة</th><th>السعر</th><th>الحالة</th></tr></thead>
      <tbody>${rows}</tbody></table>${UI.printFooter()}`);
  }

  return { init, render, form, del, printList };
})();
