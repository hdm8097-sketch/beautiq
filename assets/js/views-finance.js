/* =========================================================
   BeautiQ — المالية (فواتير / مصروفات / ملخص مالي)
   ========================================================= */
const Finance = (() => {
  const f = { tab: "invoices", q: "", method: "" };

  function init() {
    UI.$("#btnNewInvoice").addEventListener("click", () => newInvoice());
    UI.$("#btnAddExpense").addEventListener("click", () => expenseForm());
    UI.$("#finSearch").addEventListener("input", e => { f.q = e.target.value.trim(); render(); });
    UI.$("#finMethod").addEventListener("change", e => { f.method = e.target.value; render(); });
    UI.$$("#finTabs .tab").forEach(t => t.onclick = () => {
      f.tab = t.dataset.tab;
      UI.$$("#finTabs .tab").forEach(x => x.classList.toggle("active", x === t));
      render();
    });
    const m = UI.$("#finMethod");
    Object.entries(PAY_METHODS).forEach(([k, v]) =>
      m.insertAdjacentHTML("beforeend", `<option value="${k}">${v.ar}</option>`));
  }

  /* ================= الرندر ================= */
  function render() {
    const st = Store.get();
    const tf = UI.$("#finFilters");
    if (tf) tf.hidden = f.tab !== "invoices";

    const thisM = Store.rangeThisMonth();
    const income = st.invoices.filter(i => Store.inRange(i.date, ...Object.values(thisM))).reduce((t, i) => t + i.total, 0);
    const exp = st.expenses.filter(e => Store.inRange(e.d, ...Object.values(thisM))).reduce((t, e) => t + e.amount, 0);
    const credit = st.invoices.filter(i => i.method === "credit").reduce((t, i) => t + i.total, 0);

    UI.$("#finStats").innerHTML = `
      <div class="card" data-ico="📈"><div class="k">إيرادات الشهر</div><div class="v" style="font-size:17px">${UI.money(income)}</div>
        <div class="s">${st.invoices.filter(i => Store.inRange(i.date, ...Object.values(thisM))).length} فاتورة</div></div>
      <div class="card i3" data-ico="🧾"><div class="k">مصروفات الشهر</div><div class="v" style="font-size:17px">${UI.money(exp)}</div>
        <div class="s">${st.expenses.filter(e => Store.inRange(e.d, ...Object.values(thisM))).length} بند</div></div>
      <div class="card i2" data-ico="💰"><div class="k">صافي الربح</div><div class="v" style="font-size:17px">${income - exp >= 0 ? "▲ " : "▼ "}${UI.money(income - exp)}</div>
        <div class="s">هامش ${income ? Math.round((income - exp) / income * 100) : 0}%</div></div>
      <div class="card i4" data-ico="⏳"><div class="k">مبالغ آجلة</div><div class="v" style="font-size:17px">${UI.money(credit)}</div>
        <div class="s">فواتير دفعها لاحقاً</div></div>`;

    if (f.tab === "invoices") renderInvoices();
    else if (f.tab === "expenses") renderExpenses();
    else renderSummary();
  }

  /* ================= الفواتير ================= */
  function renderInvoices() {
    const st = Store.get();
    let list = st.invoices.slice().sort((a, b) => b.date - a.date);
    if (f.method) list = list.filter(i => i.method === f.method);
    if (f.q) list = list.filter(i => {
      const c = Store.getClient(i.cid);
      return (i.no + " " + ((c || {}).name || "")).toLowerCase().includes(f.q.toLowerCase());
    });

    if (!list.length) {
      UI.$("#finBody").innerHTML = UI.empty("🧾", "لا توجد فواتير",
        "أنشئ أول فاتورة من زر «فاتورة جديدة» أو من إتمام حجز",
        `<button class="btn btn-primary" onclick="Finance.newInvoice()">+ فاتورة جديدة</button>`);
      return;
    }

    const rows = list.map(i => {
      const c = Store.getClient(i.cid);
      return `<tr>
        <td><b>${i.no}</b></td>
        <td>${UI.fmtDate(i.date)}</td>
        <td>${UI.esc((c || {}).name || "—")}</td>
        <td>${i.items.length}</td>
        <td>${UI.tag((PAY_METHODS[i.method] || {}).ar, i.method === "credit" ? "warn" : "")}</td>
        <td class="money">${UI.money(i.total)}</td>
        <td><div class="filters">
          <button class="btn btn-sm btn-ghost" data-view="${i.id}">👁️</button>
          <button class="btn btn-sm btn-ghost" data-print="${i.id}">🖨️</button>
          <button class="btn btn-sm btn-danger" data-del="${i.id}">🗑️</button>
        </div></td></tr>`;
    }).join("");

    UI.$("#finBody").innerHTML = `<div class="panel"><div class="panel-bd table-wrap">
      <table class="table"><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>العميل</th><th>البنود</th>
        <th>الدفع</th><th>الإجمالي</th><th></th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><th colspan="5">إجمالي المعروض</th><th class="money">${UI.money(list.reduce((t, i) => t + i.total, 0))}</th><th></th></tr></tfoot>
      </table></div></div>`;

    UI.$("#finBody").onclick = ev => {
      const t = ev.target.closest("button"); if (!t) return;
      if (t.dataset.view) viewInvoice(t.dataset.view);
      if (t.dataset.print) printInvoice(t.dataset.print);
      if (t.dataset.del) delInvoice(t.dataset.del);
    };
  }

  /* ================= فاتورة جديدة (POS) ================= */
  function newInvoice(cid, apptId, prefill) {
    const st = Store.get();
    if (!st.clients.length) return UI.toast("أضف عميلاً أولاً", "err");
    const items = [];

    const linesHTML = () => items.map((it, idx) => `
      <div class="pos-line">
        <div class="p-name">${it.type === "service" ? "💆" : "📦"} ${UI.esc(it.name)}</div>
        <input type="number" min="1" value="${it.qty}" data-q="${idx}">
        <input type="number" min="0" step="1000" value="${it.price}" data-p="${idx}">
        <button class="pos-rm" data-rm="${idx}">✕</button>
      </div>`).join("");

    const totalsHTML = () => {
      const sub = items.reduce((t, it) => t + it.price * it.qty, 0);
      const disc = parseInt(UI.$("#inDisc") ? UI.$("#inDisc").value : 0) || 0;
      const taxRate = st.settings.tax || 0;
      const tax = Math.round(Math.max(0, sub - disc) * taxRate / 100);
      const total = Math.max(0, sub - disc) + tax;
      return `<div class="kv"><span>المجموع الفرعي</span><b class="money">${UI.money(sub)}</b></div>
        <div class="kv"><span>الخصم</span><b class="money" style="color:var(--red)">− ${UI.money(disc)}</b></div>
        ${taxRate ? `<div class="kv"><span>الضريبة (${taxRate}%)</span><b class="money">${UI.money(tax)}</b></div>` : ""}
        <div class="kv grand"><span>الإجمالي</span><b class="money">${UI.money(total)}</b></div>
        <div class="kv"><span>نقاط الولاء المكتسبة</span><b>⭐ ${Math.floor(total / st.settings.pointsPer)}</b></div>`;
    };

    const refresh = () => {
      UI.$("#inLines").innerHTML = linesHTML() || `<p class="muted" style="margin:0">لا بنود بعد — أضف خدمة أو منتج.</p>`;
      UI.$("#inTotals").innerHTML = totalsHTML();
      UI.$("#inSvc").innerHTML = `<option value="">＋ خدمة…</option>` +
        st.services.filter(s => s.active).map(s => `<option value="${s.id}">${UI.esc(s.name)} — ${UI.money(s.price)}</option>`).join("");
      UI.$("#inPd").innerHTML = `<option value="">＋ منتج…</option>` +
        st.products.filter(p => p.qty > 0).map(p => `<option value="${p.id}">${UI.esc(p.name)} — متبقي ${p.qty}</option>`).join("");
    };

    UI.modal({
      wide: true,
      title: "فاتورة جديدة",
      body: `<div class="form-grid">
        <label>العميل *<select id="inClient">
          <option value="">— بدون عميل —</option>
          ${st.clients.map(c => `<option value="${c.id}" ${c.id === cid ? "selected" : ""}>${UI.esc(c.name)}</option>`).join("")}
        </select></label>
        <label>تاريخ الفاتورة<input type="date" id="inDate" value="${UI.today()}"></label>
        <label>طريقة الدفع<select id="inMethod">${Object.entries(PAY_METHODS).map(([k, v]) =>
          `<option value="${k}">${v.ar}</option>`).join("")}</select></label>
        <label>الموظف/المسؤول<select id="inStaff"><option value="">—</option>
          ${st.staff.filter(s => s.active).map(s => `<option value="${s.id}">${UI.esc(s.name)}</option>`).join("")}</select></label>
        <label>خصم (د.ع)<input type="number" id="inDisc" value="0" min="0" step="1000"></label>
        <label>ملاحظة<input type="text" id="inNote" placeholder="اختياري"></label>
      </div>

      <div class="divider-lbl">بنود الفاتورة</div>
      <div id="inLines"></div>
      <div class="pos-add">
        <select id="inSvc"></select><button class="btn btn-soft" id="inSvcBtn">إضافة خدمة</button>
        <select id="inPd"></select><button class="btn btn-soft" id="inPdBtn">إضافة منتج</button>
      </div>

      <div class="pos-totals" id="inTotals"></div>`,
      saveText: "إصدار الفاتورة",
      onSave() {
        if (!items.length) return UI.toast("أضف بنداً واحداً على الأقل", "err");
        const c = Store.getClient(UI.$("#inClient").value);
        const disc = Math.max(0, parseInt(UI.$("#inDisc").value) || 0);
        const sub = items.reduce((t, it) => t + it.price * it.qty, 0);
        if (disc > sub) return UI.toast("الخصم أكبر من المجموع", "err");
        const date = new Date(UI.$("#inDate").value + "T" + new Date().toTimeString().slice(0, 5)).getTime();
        const inv = Store.mkInvoice(-1, items, date, disc, UI.$("#inMethod").value, UI.$("#inStaff").value || null);
        inv.cid = c ? c.id : null;
        inv.note = UI.$("#inNote").value.trim();
        inv.apptId = apptId || null;
        Store.get().invoices.push(inv);

        /* خصم المنتجات من المخزون */
        items.filter(it => it.type === "product").forEach(it => {
          const p = Store.getProduct(it.ref);
          if (p) Store.addMove(p.id, "out", it.qty, "بيع — " + inv.no);
        });
        /* نقاط الولاء */
        if (c) {
          c.points = (c.points || 0) + inv.points;
          Store.log(`فاتورة ${inv.no} — ${c.name} (+${inv.points} نقطة)`);
        } else Store.log(`فاتورة ${inv.no}`);
        /* ربط الحجز */
        if (apptId) { const a = Store.getAppt(apptId); if (a) a.invoiceId = inv.id; }

        Store.save(); UI.closeModal(); render(); App.refreshSidebar();
        UI.toast(`أُصدرت ${inv.no} — ${UI.money(inv.total)} ✓`);
        setTimeout(() => viewInvoice(inv.id), 350);
      }
    });

    UI.$("#inSvcBtn").onclick = () => {
      const s = Store.getService(UI.$("#inSvc").value); if (!s) return;
      items.push({ type: "service", ref: s.id, name: s.name, qty: 1, price: s.price }); refresh();
    };
    UI.$("#inPdBtn").onclick = () => {
      const p = Store.getProduct(UI.$("#inPd").value); if (!p) return;
      items.push({ type: "product", ref: p.id, name: p.name, qty: 1, price: p.sell }); refresh();
    };
    UI.$("#inLines").onclick = ev => {
      const b = ev.target.closest("[data-rm]"); if (!b) return;
      items.splice(+b.dataset.rm, 1); refresh();
    };
    UI.$("#inLines").addEventListener("input", ev => {
      const q = ev.target.dataset.q, p = ev.target.dataset.p;
      if (q != null) items[+q].qty = Math.max(1, parseInt(ev.target.value) || 1);
      if (p != null) items[+p].price = Math.max(0, parseInt(ev.target.value) || 0);
      UI.$("#inTotals").innerHTML = totalsHTML();
    });
    UI.$("#inDisc").addEventListener("input", () => UI.$("#inTotals").innerHTML = totalsHTML());
    if (prefill && prefill.length) items.push(...prefill);
    refresh();
  }

  /* فاتورة من حجز منجز */
  function invoiceFromAppt(apptId) {
    const a = Store.getAppt(apptId); if (!a) return;
    const prefill = a.items.map(it => ({ type: "service", ref: it.ref, name: it.name, qty: 1, price: it.price }));
    newInvoice(a.cid, apptId, prefill);
  }

  /* ================= عرض / طباعة الفاتورة ================= */
  function viewInvoice(id) {
    const i = Store.getInvoice(id); if (!i) return;
    const c = Store.getClient(i.cid);
    UI.modal({
      hideSave: true,
      title: `الفاتورة ${i.no}`,
      body: `<div class="pill-row" style="margin-bottom:10px">
          ${UI.tag(UI.fmtDate(i.date), "mus")}${UI.tag((PAY_METHODS[i.method] || {}).ar, "ok")}
          ${i.staffId ? UI.tag((Store.getStaff(i.staffId) || {}).name || "", "info") : ""}</div>
        <div class="kv"><span>العميل</span><b>${UI.esc((c || {}).name || "زائر")}</b></div>
        <div class="kv"><span>نقاط مكتسبة</span><b>⭐ ${i.points || 0}</b></div>
        <div class="sect-title">البنود</div>
        ${i.items.map(it => `<div class="kv"><span>${it.type === "product" ? "📦" : "💆"} ${UI.esc(it.name)} × ${it.qty}</span>
          <b class="money">${UI.money(it.price * it.qty)}</b></div>`).join("")}
        <div class="pos-totals">
          <div class="kv"><span>المجموع الفرعي</span><b class="money">${UI.money(i.subtotal)}</b></div>
          <div class="kv"><span>الخصم</span><b class="money">− ${UI.money(i.discount)}</b></div>
          ${i.tax ? `<div class="kv"><span>الضريبة</span><b class="money">${UI.money(i.tax)}</b></div>` : ""}
          <div class="kv grand"><span>الإجمالي</span><b class="money">${UI.money(i.total)}</b></div>
        </div>
        ${i.note ? `<p class="muted" style="font-size:13px">${UI.esc(i.note)}</p>` : ""}
        <div class="form-actions" style="margin-top:14px">
          <button class="btn btn-soft" onclick="Finance.printInvoice('${i.id}')">🖨️ طباعة</button>
          <button class="btn btn-danger" onclick="Finance.delInvoice('${i.id}')">🗑️ حذف</button>
        </div>`
    });
  }

  function printInvoice(id) {
    const i = Store.getInvoice(id); if (!i) return;
    const c = Store.getClient(i.cid), s = Store.get().settings;
    UI.print(`${UI.printHead("فاتورة", i.no)}
      <div class="p-grid">
        <div class="p-box"><b>العميل:</b> ${UI.esc((c || {}).name || "زائر")}<br>
          <b>التاريخ:</b> ${UI.fmtDate(i.date)} ${UI.fmtTime(i.date)}<br>
          <b>الدفع:</b> ${(PAY_METHODS[i.method] || {}).ar}</div>
        <div class="p-box"><b>المركز:</b> ${UI.esc(s.center)}<br><b>الهاتف:</b> ${UI.esc(s.phone)}<br>
          <b>العنوان:</b> ${UI.esc(s.address)}</div>
      </div>
      <table><thead><tr><th>البند</th><th>النوع</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
      <tbody>${i.items.map(it => `<tr><td>${UI.esc(it.name)}</td>
        <td>${it.type === "product" ? "منتج" : "خدمة"}</td><td>${it.qty}</td>
        <td>${UI.money(it.price)}</td><td>${UI.money(it.price * it.qty)}</td></tr>`).join("")}</tbody>
      <tfoot>
        <tr><th colspan="4">المجموع الفرعي</th><td>${UI.money(i.subtotal)}</td></tr>
        ${i.discount ? `<tr><th colspan="4">الخصم</th><td>− ${UI.money(i.discount)}</td></tr>` : ""}
        ${i.tax ? `<tr><th colspan="4">الضريبة</th><td>${UI.money(i.tax)}</td></tr>` : ""}
        <tr><th colspan="4">الإجمالي المطلوب</th><td><b>${UI.money(i.total)}</b></td></tr>
      </tfoot></table>
      ${i.points ? `<p>⭐ حصل العميل على ${i.points} نقطة ولاء.</p>` : ""}
      ${UI.printFooter()}`);
  }

  function delInvoice(id) {
    const i = Store.getInvoice(id); if (!i) return;
    UI.confirm(`حذف الفاتورة <b>${i.no}</b>؟ لن تُعاد كميات المنتجات للمخزون.`, () => {
      const st = Store.get();
      st.invoices = st.invoices.filter(x => x.id !== id);
      const a = st.appointments.find(x => x.invoiceId === id);
      if (a) a.invoiceId = null;
      Store.log(`حُذفت فاتورة ${i.no}`);
      Store.save(); UI.closeModal(); render(); App.refreshSidebar();
      UI.toast("تم حذف الفاتورة", "warn");
    });
  }

  /* ================= المصروفات ================= */
  function renderExpenses() {
    const st = Store.get();
    const list = st.expenses.slice().sort((a, b) => b.d - a.d);
    const total = list.reduce((t, e) => t + e.amount, 0);
    UI.$("#finBody").innerHTML = `
      <div class="panel"><div class="panel-hd">
        <h2>المصروفات <em>مجموع ${UI.money(total)}</em></h2></div>
        <div class="panel-bd table-wrap">
        <table class="table"><thead><tr><th>التاريخ</th><th>البند</th><th>التصنيف</th><th>المبلغ</th><th></th></tr></thead>
        <tbody>${list.map(e => `<tr>
          <td>${UI.fmtDate(e.d)}</td><td>${UI.esc(e.note || "—")}</td>
          <td>${UI.tag((EXPENSE_CATS[e.cat] || {}).ar, "warn")}</td>
          <td class="money">${UI.money(e.amount)}</td>
          <td><button class="btn btn-sm btn-danger" data-del="${e.id}">🗑️</button></td></tr>`).join("")
          || `<tr><td colspan="5">لا توجد مصروفات</td></tr>`}</tbody>
        <tfoot><tr><th colspan="3">الإجمالي</th><th class="money">${UI.money(total)}</th><th></th></tr></tfoot>
        </table></div></div>`;
    UI.$("#finBody").onclick = ev => {
      const t = ev.target.closest("[data-del]"); if (!t) return;
      const e = st.expenses.find(x => x.id === t.dataset.del);
      UI.confirm(`حذف مصروف «${UI.esc(e.note || "")}»؟`, () => {
        st.expenses = st.expenses.filter(x => x.id !== e.id);
        Store.log("حُذف مصروف"); Store.save(); render();
        UI.toast("تم الحذف", "warn");
      });
    };
  }

  function expenseForm() {
    UI.modal({
      title: "تسجيل مصروف",
      body: `<div class="form-grid">
        <label>التاريخ<input type="date" id="exDate" value="${UI.today()}"></label>
        <label>التصنيف<select id="exCat">${Object.entries(EXPENSE_CATS).map(([k, v]) =>
          `<option value="${k}">${v.ar}</option>`).join("")}</select></label>
        <label>المبلغ (د.ع) *<input type="number" id="exAmt" min="0" step="1000"></label>
        <label>البيان<input type="text" id="exNote" placeholder="مثال: طلبية مواد"></label>
      </div>`,
      saveText: "تسجيل",
      onSave() {
        const amt = parseInt(UI.$("#exAmt").value);
        if (!(amt > 0)) return UI.toast("أدخل مبلغاً صحيحاً", "err");
        const d = new Date(UI.$("#exDate").value + "T12:00").getTime();
        Store.get().expenses.push({ id: Store.uid("ex"), d, cat: UI.$("#exCat").value, amount: amt, note: UI.$("#exNote").value.trim() });
        Store.log(`مصروف ${UI.money(amt)} — ${UI.$("#exNote").value.trim() || (EXPENSE_CATS[UI.$("#exCat").value] || {}).ar}`);
        Store.save(); UI.closeModal(); render(); App.refreshSidebar();
        UI.toast("سُجّل المصروف ✓");
      }
    });
  }

  /* ================= الملخص المالي ================= */
  function renderSummary() {
    const st = Store.get();
    const now = new Date();
    const months = [], income = [], expense = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const from = d.getTime();
      const to = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
      months.push(UI.monthAr(d.getMonth()).slice(0, 7));
      income.push(st.invoices.filter(x => x.date >= from && x.date < to).reduce((t, x) => t + x.total, 0));
      expense.push(st.expenses.filter(x => x.d >= from && x.d < to).reduce((t, x) => t + x.amount, 0));
    }

    /* أفضل الخدمات */
    const svCount = {};
    st.appointments.filter(a => a.status === "done").forEach(a =>
      a.items.forEach(i2 => { svCount[i2.name] = (svCount[i2.name] || 0) + 1; }));
    const topSv = Object.entries(svCount).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([l, v]) => ({ l: l.slice(0, 10), v }));

    /* توزيع طرق الدفع */
    const pm = {};
    st.invoices.forEach(i2 => { pm[i2.method] = (pm[i2.method] || 0) + i2.total; });
    const pmTotal = Object.values(pm).reduce((t, x) => t + x, 0) || 1;

    const totalInc = income.reduce((t, x) => t + x, 0);
    const totalExp = expense.reduce((t, x) => t + x, 0);

    UI.$("#finBody").innerHTML = `
      <div class="grid-2">
        <div class="panel"><div class="panel-hd"><h2>الإيرادات مقابل المصروفات <em>آخر 6 أشهر</em></h2></div>
          <div class="panel-bd">${UI.lineChart(income, { labels: months, unit: "إيراد", short: true })}
            <div class="legend"><i style="background:var(--brand)"></i> إجمالي الإيرادات (${UI.money(totalInc)})</div>
            ${UI.barChart(expense.map((v, i) => ({ l: months[i], v: Math.round(v / 1000) })))}
            <div class="legend"><i style="background:var(--brand2)"></i> المصروفات بالألف دينار (${UI.money(totalExp)})</div>
          </div></div>
        <div class="panel"><div class="panel-hd"><h2>أكثر الخدمات حجزاً <em>Top services</em></h2></div>
          <div class="panel-bd">${topSv.length ? topSv.map((s, idx) => `
            <div class="rank"><span class="pos ${idx === 0 ? "top" : ""}">${idx + 1}</span>
              <span style="flex:0 0 auto;min-width:110px;font-size:13px">${UI.esc(s.l)}</span>
              <span class="bar"><i style="width:${Math.round(s.v / topSv[0].v * 100)}%"></i></span>
              <span class="val">${s.v} حجز</span></div>`).join("")
            : `<p class="muted">لا توجد بيانات بعد.</p>`}</div></div>
      </div>
      <div class="panel"><div class="panel-hd"><h2>توزيع طرق الدفع <em>Payment mix</em></h2></div>
        <div class="panel-bd">
          ${Object.entries(pm).map(([k, v]) => {
            const pct = Math.round(v / pmTotal * 100);
            return `<div class="rank"><span style="flex:0 0 auto;min-width:90px;font-size:13px">${(PAY_METHODS[k] || {}).ar}</span>
              <span class="bar"><i style="width:${pct}%"></i></span>
              <span class="val">${UI.money(v)} · ${pct}%</span></div>`;
          }).join("") || `<p class="muted">لا توجد فواتير.</p>`}
        </div></div>`;
  }

  return { init, render, newInvoice, invoiceFromAppt, viewInvoice, printInvoice, delInvoice, expenseForm };
})();
