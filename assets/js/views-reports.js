/* =========================================================
   BeautiQ — التقارير التفصيلية (مع طباعة)
   ========================================================= */
const Reports = (() => {
  let period = "30";   /* today | 7 | 30 | month | all */

  function init() {
    UI.$("#repPeriod").addEventListener("change", e => { period = e.target.value; render(); });
    UI.$("#btnPrintReport").addEventListener("click", printReport);
  }

  function range() {
    if (period === "today") { const r = Store.rangeDays(1); return r; }
    if (period === "7") return Store.rangeDays(7);
    if (period === "30") return Store.rangeDays(30);
    if (period === "month") return Store.rangeThisMonth();
    return { from: 0, to: Date.now() + 1 };
  }

  function periodLabel() {
    return { today: "اليوم", "7": "آخر 7 أيام", "30": "آخر 30 يوماً",
             month: "الشهر الحالي", all: "كل الفترات" }[period];
  }

  function collect() {
    const st = Store.get(), r = range();
    const invs = st.invoices.filter(i => Store.inRange(i.date, ...Object.values(r)));
    const exps = st.expenses.filter(e => Store.inRange(e.d, ...Object.values(r)));
    const appts = st.appointments.filter(a => Store.inRange(a.start, ...Object.values(r)));
    const income = invs.reduce((t, i) => t + i.total, 0);
    const expense = exps.reduce((t, e) => t + e.amount, 0);

    /* حسب الخدمة */
    const byService = {};
    appts.filter(a => a.status === "done").forEach(a => a.items.forEach(it => {
      byService[it.name] = byService[it.name] || { n: 0, v: 0 };
      byService[it.name].n++; byService[it.name].v += it.price;
    }));
    /* حسب الموظف */
    const byStaff = {};
    appts.filter(a => a.status === "done" && a.sid).forEach(a => {
      byStaff[a.sid] = byStaff[a.sid] || { n: 0, v: 0 };
      byStaff[a.sid].n++; byStaff[a.sid].v += a.price;
    });
    /* حسب التصنيف */
    const byCat = {};
    exps.forEach(e => { byCat[e.cat] = (byCat[e.cat] || 0) + e.amount; });
    /* أفضل العملاء */
    const byClient = {};
    invs.forEach(i => { if (i.cid) { byClient[i.cid] = byClient[i.cid] || { n: 0, v: 0 }; byClient[i.cid].n++; byClient[i.cid].v += i.total; } });

    return { st, invs, exps, appts, income, expense, byService, byStaff, byCat, byClient };
  }

  function render() {
    const d = collect();
    const net = d.income - d.expense;
    const done = d.appts.filter(a => a.status === "done").length;
    const cancel = d.appts.filter(a => a.status === "cancel").length;

    UI.$("#repStats").innerHTML = `
      <div class="card" data-ico="📈"><div class="k">إيرادات الفترة</div><div class="v" style="font-size:17px">${UI.money(d.income)}</div>
        <div class="s">${d.invs.length} فاتورة</div></div>
      <div class="card i3" data-ico="🧾"><div class="k">المصروفات</div><div class="v" style="font-size:17px">${UI.money(d.expense)}</div>
        <div class="s">${d.exps.length} بند</div></div>
      <div class="card i2" data-ico="💰"><div class="k">صافي الربح</div><div class="v" style="font-size:17px">${net >= 0 ? "▲ " : "▼ "}${UI.money(net)}</div>
        <div class="s">هامش ${d.income ? Math.round(net / d.income * 100) : 0}%</div></div>
      <div class="card i4" data-ico="🧮"><div class="k">متوسط الفاتورة</div><div class="v" style="font-size:17px">${UI.money(d.invs.length ? Math.round(d.income / d.invs.length) : 0)}</div>
        <div class="s">هامش ${d.income ? Math.round(net / d.income * 100) : 0}%</div></div>`;

    UI.$("#repExtra").innerHTML = `
      <div class="card" data-ico="📅"><div class="k">مواعيد الفترة</div><div class="v">${d.appts.length}</div>
        <div class="s">${done} منجز · ${cancel} ملغي</div></div>
      <div class="card i2" data-ico="🎯"><div class="k">نسبة الإنجاز</div><div class="v">${d.appts.length ? Math.round(done / d.appts.length * 100) : 0}%</div>
        <div class="s">من إجمالي الحجوزات</div></div>
      <div class="card i3" data-ico="👥"><div class="k">عملاء زاروا المركز</div><div class="v">${new Set(d.appts.map(a => a.cid)).size}</div>
        <div class="s">من ${d.st.clients.length} عميل</div></div>
      <div class="card i4" data-ico="📦"><div class="k">قيمة المخزون</div><div class="v" style="font-size:17px">${UI.money(d.st.products.reduce((t, p) => t + p.qty * p.buy, 0))}</div>
        <div class="s">${d.st.products.filter(p => Store.isLow(p)).length} منتج ناقص</div></div>`;

    /* ---- الإيراد اليومي ---- */
    const r = range();
    const days = Math.max(1, Math.min(30, Math.ceil((r.to - r.from) / 86400000)));
    const labels = [], vals = [];
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(); dt.setHours(0, 0, 0, 0); dt.setDate(dt.getDate() - i);
      const k = dt.getTime();
      labels.push(String(dt.getDate()).padStart(2, "0") + "/" + (dt.getMonth() + 1));
      vals.push(d.invs.filter(x => UI.dayKey(x.date) === UI.dayKey(k)).reduce((t, x) => t + x.total, 0));
    }

    const svcRows = Object.entries(d.byService).sort((a, b) => b[1].v - a[1].v);
    const maxSvc = svcRows.length ? svcRows[0][1].v : 1;
    const staffRows = Object.entries(d.byStaff).sort((a, b) => b[1].v - a[1].v);
    const clientRows = Object.entries(d.byClient).sort((a, b) => b[1].v - a[1].v).slice(0, 8);
    const catRows = Object.entries(d.byCat).sort((a, b) => b[1] - a[1]);
    const maxCat = catRows.length ? catRows[0][1] : 1;

    UI.$("#repBody").innerHTML = `
      <div class="panel"><div class="panel-hd"><h2>منحنى الإيراد اليومي <em>${periodLabel()}</em></h2></div>
        <div class="panel-bd">${UI.lineChart(vals, { labels, short: true, unit: "إيراد" })}</div></div>

      <div class="grid-2">
        <div class="panel"><div class="panel-hd"><h2>أداء الخدمات <em>Revenue by service</em></h2></div>
          <div class="panel-bd">${svcRows.length ? svcRows.map(([name, v], i) => `
            <div class="rank"><span class="pos ${i === 0 ? "top" : ""}">${i + 1}</span>
              <span style="flex:0 0 auto;min-width:120px;font-size:13px">${UI.esc(name)}</span>
              <span class="bar"><i style="width:${Math.round(v.v / maxSvc * 100)}%"></i></span>
              <span class="val">${v.n} × ${UI.money(v.v)}</span></div>`).join("")
            : `<p class="muted">لا توجد خدمات منجزة في هذه الفترة.</p>`}</div></div>

        <div class="panel"><div class="panel-hd"><h2>إنتاجية الموظفين <em>By staff</em></h2></div>
          <div class="panel-bd">${staffRows.length ? staffRows.map(([sid, v], i) => `
            <div class="rank"><span class="pos ${i === 0 ? "top" : ""}">${i + 1}</span>
              <span style="flex:0 0 auto;min-width:120px;font-size:13px">${UI.esc((Store.getStaff(sid) || {}).name || "—")}</span>
              <span class="bar"><i style="width:${Math.round(v.v / staffRows[0][1].v * 100)}%"></i></span>
              <span class="val">${v.n} جلسة · ${UI.money(v.v)}</span></div>`).join("")
            : `<p class="muted">لا توجد بيانات.</p>`}</div></div>
      </div>

      <div class="grid-2">
        <div class="panel"><div class="panel-hd"><h2>أفضل العملاء <em>Top clients</em></h2></div>
          <div class="panel-bd">${clientRows.length ? clientRows.map(([cid, v], i) => `
            <div class="rank"><span class="pos ${i === 0 ? "top" : ""}">${i + 1}</span>
              <span style="flex:0 0 auto;min-width:120px;font-size:13px">${UI.esc((Store.getClient(cid) || {}).name || "—")}</span>
              <span class="bar"><i style="width:${Math.round(v.v / clientRows[0][1].v * 100)}%"></i></span>
              <span class="val">${v.n} فاتورة · ${UI.money(v.v)}</span></div>`).join("")
            : `<p class="muted">لا توجد بيانات.</p>`}</div></div>

        <div class="panel"><div class="panel-hd"><h2>المصروفات حسب التصنيف <em>Expenses</em></h2></div>
          <div class="panel-bd">${catRows.length ? catRows.map(([cat, v], i) => `
            <div class="rank"><span class="pos ${i === 0 ? "top" : ""}">${i + 1}</span>
              <span style="flex:0 0 auto;min-width:110px;font-size:13px">${(EXPENSE_CATS[cat] || {}).ar}</span>
              <span class="bar"><i style="width:${Math.round(v / maxCat * 100)}%"></i></span>
              <span class="val">${UI.money(v)}</span></div>`).join("")
            : `<p class="muted">لا توجد مصروفات.</p>`}
          ${catRows.length ? `<div class="sect-title">توزيع المصروفات</div>
            ${UI.barChart(catRows.map(([c2, v]) => ({ l: (EXPENSE_CATS[c2] || {}).ar.slice(0, 7), v: Math.round(v / 1000) })))}` : ""}
          </div></div>
      </div>

      <div class="panel"><div class="panel-hd"><h2>تفاصيل فواتير الفترة <em>Invoices</em></h2></div>
        <div class="panel-bd table-wrap"><table class="table">
          <thead><tr><th>الفاتورة</th><th>التاريخ</th><th>العميل</th><th>البنود</th><th>الدفع</th><th>الإجمالي</th></tr></thead>
          <tbody>${d.invs.slice(0, 50).map(i => `<tr>
            <td><b>${i.no}</b></td><td>${UI.fmtDate(i.date)}</td>
            <td>${UI.esc((Store.getClient(i.cid) || {}).name || "زائر")}</td>
            <td>${i.items.length}</td><td>${(PAY_METHODS[i.method] || {}).ar}</td>
            <td class="money">${UI.money(i.total)}</td></tr>`).join("")
            || `<tr><td colspan="6">لا توجد فواتير</td></tr>`}</tbody>
          <tfoot><tr><th colspan="5">الإجمالي</th><th class="money">${UI.money(d.income)}</th></tr></tfoot>
        </table></div></div>`;
  }

  /* ---------- طباعة التقرير الشامل ---------- */
  function printReport() {
    const d = collect();
    const net = d.income - d.expense;
    const svcRows = Object.entries(d.byService).sort((a, b) => b[1].v - a[1].v)
      .map(([n, v]) => `<tr><td>${UI.esc(n)}</td><td>${v.n}</td><td>${UI.money(v.v)}</td></tr>`).join("");
    const staffRows = Object.entries(d.byStaff).sort((a, b) => b[1].v - a[1].v)
      .map(([sid, v]) => `<tr><td>${UI.esc((Store.getStaff(sid) || {}).name || "—")}</td>
        <td>${v.n}</td><td>${UI.money(v.v)}</td></tr>`).join("");
    const clientRows = Object.entries(d.byClient).sort((a, b) => b[1].v - a[1].v)
      .map(([cid, v]) => `<tr><td>${UI.esc((Store.getClient(cid) || {}).name || "—")}</td>
        <td>${v.n}</td><td>${UI.money(v.v)}</td></tr>`).join("");
    const catRows = Object.entries(d.byCat).sort((a, b) => b[1] - a[1])
      .map(([c2, v]) => `<tr><td>${(EXPENSE_CATS[c2] || {}).ar}</td><td>${UI.money(v)}</td></tr>`).join("");

    UI.print(`${UI.printHead("تقرير مالي وإداري شامل", periodLabel())}
      <div class="p-grid">
        <div class="p-box"><b>الإيرادات:</b> ${UI.money(d.income)} (${d.invs.length} فاتورة)<br>
          <b>المصروفات:</b> ${UI.money(d.expense)} (${d.exps.length} بند)<br>
          <b>صافي الربح:</b> ${UI.money(net)}</div>
        <div class="p-box"><b>المواعيد:</b> ${d.appts.length} (${d.appts.filter(a => a.status === "done").length} منجز)<b></b><br>
          <b>متوسط الفاتورة:</b> ${UI.money(d.invs.length ? Math.round(d.income / d.invs.length) : 0)}<br>
          <b>عملاء فريدون:</b> ${new Set(d.appts.map(a => a.cid)).size}</div>
      </div>
      <h3>أداء الخدمات</h3>
      <table><thead><tr><th>الخدمة</th><th>عدد مرات التنفيذ</th><th>الإيراد</th></tr></thead>
        <tbody>${svcRows || `<tr><td colspan="3">لا بيانات</td></tr>`}</tbody></table>
      <h3>إنتاجية الموظفين</h3>
      <table><thead><tr><th>الموظف</th><th>جلسات</th><th>الإيراد</th></tr></thead>
        <tbody>${staffRows || `<tr><td colspan="3">لا بيانات</td></tr>`}</tbody></table>
      <h3>أفضل العملاء</h3>
      <table><thead><tr><th>العميل</th><th>فواتير</th><th>الإنفاق</th></tr></thead>
        <tbody>${clientRows || `<tr><td colspan="3">لا بيانات</td></tr>`}</tbody></table>
      <h3>المصروفات حسب التصنيف</h3>
      <table><thead><tr><th>التصنيف</th><th>المبلغ</th></tr></thead>
        <tbody>${catRows || `<tr><td colspan="2">لا بيانات</td></tr>`}</tbody></table>
      ${UI.printFooter()}`);
  }

  return { init, render, printReport };
})();
