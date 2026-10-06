/* =========================================================
   BeautiQ — المخزون (منتجات / حركات / تنبيهات النقص)
   ========================================================= */
const Inventory = (() => {
  const f = { q: "", cat: "", low: false };

  function init() {
    UI.$("#btnAddProduct").addEventListener("click", () => form());
    UI.$("#invSearch").addEventListener("input", e => { f.q = e.target.value.trim(); render(); });
    UI.$("#invCat").addEventListener("change", e => { f.cat = e.target.value; render(); });
    UI.$("#invLowBtn").addEventListener("click", () => { f.low = !f.low; render(); });
    UI.$("#btnPrintLow").addEventListener("click", printLow);
    const s = UI.$("#invCat");
    Object.entries(PRODUCT_CATS).forEach(([k, v]) =>
      s.insertAdjacentHTML("beforeend", `<option value="${k}">${v.ar}</option>`));
  }

  function render() {
    const st = Store.get();
    let list = st.products.slice();
    if (f.cat) list = list.filter(p => p.cat === f.cat);
    if (f.q) list = list.filter(p => p.name.toLowerCase().includes(f.q.toLowerCase()));
    if (f.low) list = list.filter(p => Store.isLow(p));

    const lows = st.products.filter(p => Store.isLow(p));
    const value = st.products.reduce((t, p) => t + p.qty * p.buy, 0);
    const retail = st.products.reduce((t, p) => t + p.qty * p.sell, 0);
    UI.$("#invLowBtn").className = lows.length ? "btn btn-danger" : "btn btn-soft";
    UI.$("#invLowBtn").textContent = `⚠️ منتجات ناقصة (${lows.length})`;

    UI.$("#invStats").innerHTML = `
      <div class="card" data-ico="📦"><div class="k">عدد المنتجات</div><div class="v">${st.products.length}</div>
        <div class="s">${new Set(st.products.map(p => p.cat)).size} فئات</div></div>
      <div class="card i2" data-ico="🏷"><div class="k">قيمة المخزون (تكلفة)</div><div class="v" style="font-size:17px">${UI.money(value)}</div>
        <div class="s">بتسعير البيع: ${UI.money(retail)}</div></div>
      <div class="card i3" data-ico="⚠️"><div class="k">تحت حد التنبيه</div><div class="v">${lows.length}</div>
        <div class="s">${lows.length ? "يجب إعادة طلبها" : "المخزون بحالة جيدة"}</div></div>
      <div class="card i4" data-ico="🔄"><div class="k">حركات مسجّلة</div><div class="v">${st.stock.length}</div>
        <div class="s">إدخال/استهلاك</div></div>`;

    if (!list.length) {
      UI.$("#invGrid").innerHTML = UI.empty("📦", f.low && !lows.length ? "لا توجد منتجات ناقصة" : "لا توجد منتجات",
        f.low && !lows.length ? "كل المنتجات فوق حد التنبيه" : "أضف منتجاتك وموادك الاستهلاكية",
        `<button class="btn btn-primary" onclick="document.getElementById('btnAddProduct').click()">+ منتج جديد</button>`);
      return;
    }

    UI.$("#invGrid").innerHTML = list.map(p => {
      const low = Store.isLow(p);
      const pct = p.min > 0 ? Math.min(100, Math.round(p.qty / (p.min * 3) * 100)) : 100;
      const moves = st.stock.filter(m => m.pid === p.id).length;
      return `<article class="item ${low ? "low" : ""}">
        <div class="item-hd">
          <div style="display:flex;gap:10px;align-items:center">
            <div class="avatar ${UI.grad(p.id)}">${UI.esc(UI.initials(p.name))}</div>
            <div><h3>${UI.esc(p.name)}</h3><div class="en">${(PRODUCT_CATS[p.cat] || {}).ar || ""}</div></div>
          </div>
          ${low ? UI.tag("ناقص", "bad") : UI.tag("متوفر", "ok")}
        </div>
        <div class="item-bd">
          <div class="kv"><span>الرصيد</span><b style="color:${low ? "var(--red)" : "var(--green)"}">${p.qty} ${UI.esc(p.unit || "")}</b></div>
          <div class="qty-bar ${low ? "low" : ""}"><i style="width:${pct}%"></i></div>
          <div class="kv" style="margin-top:6px"><span>حد التنبيه</span><b>${p.min}</b></div>
          <div class="kv"><span>سعر الشراء</span><b class="money">${UI.money(p.buy)}</b></div>
          <div class="kv"><span>سعر البيع</span><b class="money">${UI.money(p.sell)}</b></div>
          <div class="kv"><span>حركات</span><b>${moves}</b></div>
        </div>
        <div class="item-ft">
          <button class="btn btn-sm btn-soft" data-move="${p.id}">↕ حركة</button>
          <button class="btn btn-sm btn-ghost" data-edit="${p.id}">✏️</button>
          <button class="btn btn-sm btn-danger" data-del="${p.id}">🗑️</button>
        </div>
      </article>`;
    }).join("");

    UI.$("#invGrid").onclick = ev => {
      const t = ev.target.closest("button"); if (!t) return;
      if (t.dataset.edit) form(Store.getProduct(t.dataset.edit));
      if (t.dataset.move) move(t.dataset.move);
      if (t.dataset.del) del(t.dataset.del);
    };
  }

  /* ---------- نموذج المنتج ---------- */
  function form(p) {
    const editing = !!p;
    UI.modal({
      title: editing ? "تعديل المنتج" : "إضافة منتج جديد",
      body: `<div class="form-grid">
        <label>اسم المنتج *<input type="text" id="pName" value="${UI.esc(p ? p.name : "")}" placeholder="مثال: سيروم فيتامين C"></label>
        <label>الفئة<select id="pCat">${Object.entries(PRODUCT_CATS).map(([k, v]) =>
          `<option value="${k}" ${p && p.cat === k ? "selected" : ""}>${v.ar}</option>`).join("")}</select></label>
        <label>الوحدة<input type="text" id="pUnit" value="${UI.esc(p ? p.unit || "" : "")}" placeholder="علبة / عبوة / قطعة"></label>
        <label>الكمية الحالية<input type="number" id="pQty" value="${p ? p.qty : 0}" min="0"></label>
        <label>حد التنبيه (أقل كمية)<input type="number" id="pMin" value="${p ? p.min : 3}" min="0"></label>
        <label>سعر الشراء (د.ع)<input type="number" id="pBuy" value="${p ? p.buy : ""}" min="0" step="500"></label>
        <label>سعر البيع (د.ع)<input type="number" id="pSell" value="${p ? p.sell : ""}" min="0" step="500"></label>
      </div>`,
      saveText: editing ? "حفظ" : "إضافة",
      onSave() {
        const name = UI.$("#pName").value.trim();
        if (!name) return UI.toast("أدخل اسم المنتج", "err");
        const qty = Math.max(0, parseInt(UI.$("#pQty").value) || 0);
        const o = p || { id: Store.uid("pd"), createdAt: Date.now() };
        const oldQty = p ? p.qty : null;
        Object.assign(o, {
          name, cat: UI.$("#pCat").value, unit: UI.$("#pUnit").value.trim(),
          qty, min: parseInt(UI.$("#pMin").value) || 0,
          buy: parseInt(UI.$("#pBuy").value) || 0, sell: parseInt(UI.$("#pSell").value) || 0
        });
        if (!p) {
          Store.get().products.push(o);
          if (qty > 0) Store.addMove(o.id, "in", qty, "رصيد افتتاحي");
        } else if (oldQty !== qty) {
          const diff = qty - oldQty;
          Store.addMove(o.id, diff > 0 ? "in" : "out", Math.abs(diff), "تعديل يدوي");
        }
        Store.log(`${editing ? "عدّل" : "أضاف"} منتج: ${name}`);
        Store.save(); UI.closeModal(); render(); App.refreshSidebar();
        UI.toast(editing ? "تم الحفظ ✓" : "أُضيف المنتج ✓");
      }
    });
  }

  /* ---------- حركة مخزون ---------- */
  function move(pid) {
    const p = Store.getProduct(pid); if (!p) return;
    const hist = Store.get().stock.filter(m => m.pid === pid).sort((a, b) => b.d - a.d).slice(0, 8);
    UI.modal({
      title: `حركة المخزون — ${p.name}`,
      body: `<div class="pill-row" style="margin-bottom:12px">
          ${UI.tag("الرصيد الحالي: " + p.qty + " " + (p.unit || ""), Store.isLow(p) ? "bad" : "ok")}
          ${UI.tag("حد التنبيه: " + p.min, "warn")}</div>
        <div class="form-grid">
          <label>نوع الحركة<select id="mvType">
            <option value="in">إدخال / توريد +</option>
            <option value="out">استهلاك / صرف −</option></select></label>
          <label>الكمية<input type="number" id="mvQty" min="1" value="1"></label>
        </div>
        <label style="margin-top:10px">ملاحظة<input type="text" id="mvNote" placeholder="مثال: توريد من المورد / استهلاك جلسة"></label>
        <div class="sect-title">آخر الحركات</div>
        ${hist.length ? hist.map(m => `<div class="kv"><span>${UI.fmtDate(m.d)} ${m.note ? "· " + UI.esc(m.note) : ""}</span>
          <b style="color:${m.type === "in" ? "var(--green)" : "var(--red)"}">${m.type === "in" ? "+" : "−"}${m.qty}</b></div>`).join("")
          : `<p class="muted" style="margin:0">لا توجد حركات.</p>`}`,
      saveText: "تسجيل الحركة",
      onSave() {
        const qty = parseInt(UI.$("#mvQty").value);
        if (!(qty > 0)) return UI.toast("أدخل كمية صحيحة", "err");
        const type = UI.$("#mvType").value;
        if (type === "out" && qty > p.qty) return UI.toast("الكمية أكبر من الرصيد المتاح", "err");
        Store.addMove(pid, type, qty, UI.$("#mvNote").value.trim());
        Store.log(`${type === "in" ? "أدخل" : "صرف"} ${qty} من ${p.name}`);
        Store.save(); UI.closeModal(); render();
        UI.toast("سُجّلت الحركة ✓");
      }
    });
  }

  function del(id) {
    const p = Store.getProduct(id); if (!p) return;
    UI.confirm(`حذف منتج «${UI.esc(p.name)}» وحركاته؟`, () => {
      const st = Store.get();
      st.products = st.products.filter(x => x.id !== id);
      st.stock = st.stock.filter(m => m.pid !== id);
      Store.log(`حذف منتج: ${p.name}`);
      Store.save(); render(); App.refreshSidebar();
      UI.toast("تم الحذف", "warn");
    });
  }

  function printLow() {
    const lows = Store.get().products.filter(p => Store.isLow(p))
      .sort((a, b) => (a.qty - a.min) - (b.qty - b.min));
    const rows = lows.map(p => `<tr><td>${UI.esc(p.name)}</td><td>${(PRODUCT_CATS[p.cat] || {}).ar}</td>
      <td>${p.qty} ${UI.esc(p.unit || "")}</td><td>${p.min}</td><td>${Math.max(0, p.min * 2 - p.qty)}</td>
      <td>${UI.money(p.buy * Math.max(0, p.min * 2 - p.qty))}</td></tr>`).join("");
    UI.print(`${UI.printHead("تقرير المنتجات الناقصة", "Low stock")}
      <table><thead><tr><th>المنتج</th><th>الفئة</th><th>الرصيد</th><th>الحد</th><th>الكمية المقترحة للطلب</th><th>التكلفة</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6">لا توجد منتجات ناقصة</td></tr>`}</tbody>
      <tfoot><tr><th colspan="5">إجمالي تكلفة الطلب المقترح</th>
        <th>${UI.money(lows.reduce((t, p) => t + p.buy * Math.max(0, p.min * 2 - p.qty), 0))}</th></tr></tfoot></table>
      ${UI.printFooter()}`);
  }

  return { init, render, form, move, del, printLow };
})();
