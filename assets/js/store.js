/* =========================================================
   BeautiQ — إدارة الحالة والتخزين المحلي
   ========================================================= */
const KEY = "aureva.v1";

const Store = (() => {
  let state = null, warned = false;

  const defaults = () => ({
    settings: {
      center: "مركز BeautiQ للتجميل", doctor: "د. سارة الجابر", phone: "0770 123 4567",
      address: "بغداد — شارع الكرادة", currency: "IQD", rate: 1310, tax: 0,
      pointsPer: 100000,   /* نقطة لكل كل 100 ألف د.ع مدفوعة */
      pointValue: 5000,    /* قيمة النقطة بالدينار عند الاستبدال */
      theme: "salon", faceV2: 1, created: Date.now()
    },
    clients: [], services: [], products: [], stock: [],
    staff: [], attendance: [], appointments: [], invoices: [], expenses: [],
    customServices: [], activity: [],
    counters: { invoice: 1001 }
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const hadFace = !!(parsed && parsed.settings && parsed.settings.faceV2);
      state = parsed ? Object.assign(defaults(), parsed) : defaults();
      state.settings = Object.assign(defaults().settings, state.settings || {});
      /* ترقية مرة واحدة: الانتقال لواجهة سلون الافتراضية الجديدة */
      if (!hadFace) {
        if (state.settings.theme === "dark") state.settings.theme = "salon";
        state.settings.faceV2 = 1;
        save();
      }
      if (state.settings.center === "مركز أوريفا للتجميل") {
        state.settings.center = "مركز BeautiQ للتجميل";
        save();
      }
      if (!state.clients.length && !state.services.length) seed();
    } catch (e) { state = defaults(); warned = true; }
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) {
      if (!warned) { warned = true; UI.toast("تنبيه: التخزين غير متاح — لن تُحفظ البيانات بعد إغلاق الصفحة", "warn"); }
    }
  }

  const uid = p => p + "-" + Math.random().toString(36).slice(2, 9);

  function log(text) {
    state.activity.unshift({ t: text, d: Date.now() });
    state.activity = state.activity.slice(0, 40);
    save();
  }

  /* ================= بيانات تجريبية أولى ================= */
  function seed() {
    const now = Date.now(), D = 86400000, H = 3600000;
    const day = n => { const d = new Date(now + n * D); d.setHours(0, 0, 0, 0); return d.getTime(); };

    /* -- خدمات -- */
    state.services = SEED_SERVICES.map(s => ({
      id: uid("sv"), name: s.name, cat: s.cat, price: s.price, dur: s.dur, active: true
    }));

    /* -- منتجات -- */
    state.products = SEED_PRODUCTS.map(p => ({
      id: uid("pd"), name: p.name, cat: p.cat, qty: p.qty, min: p.min,
      buy: p.buy, sell: p.sell, unit: p.unit, createdAt: now
    }));
    state.stock = state.products.map(p => ({
      id: uid("mv"), pid: p.id, type: "in", qty: p.qty, d: now - 30 * D, note: "رصيد افتتاحي"
    }));

    /* -- موظفون -- */
    state.staff = [
      { id: uid("st"), name: "د. سارة الجابر", role: "doctor", phone: "0770 111 2222",
        salary: 2500000, active: true, perms: { clients: 1, appointments: 1, services: 1, finance: 1, reports: 1, employees: 1, settings: 1, inventory: 1 } },
      { id: uid("st"), name: "نور الهدى كريم", role: "therapist", phone: "0781 333 4444",
        salary: 1200000, active: true, perms: { clients: 1, appointments: 1, services: 1 } },
      { id: uid("st"), name: "مروة عبد الله", role: "therapist", phone: "0750 555 6666",
        salary: 1200000, active: true, perms: { clients: 1, appointments: 1, inventory: 1 } },
      { id: uid("st"), name: "علي حسين جبار", role: "dentist", phone: "0771 777 8888",
        salary: 2000000, active: true, perms: { clients: 1, appointments: 1, services: 1, reports: 1 } },
      { id: uid("st"), name: "زينة مهدي", role: "reception", phone: "0782 999 0000",
        salary: 800000, active: true, perms: { clients: 1, appointments: 1, finance: 1, inventory: 1 } }
    ];

    /* -- عملاء -- */
    const C = (name, phone, src, days, pts, notes) => ({
      id: uid("cl"), name, phone, gender: "f", src, birthday: "",
      points: pts || 0, notes: notes || "", createdAt: day(-days)
    });
    state.clients = [
      C("هدى عبد الرزاق", "0770 456 7890", "ref", 90, 42, "بشرة حساسة — تفضيل الواقية الشمسية."),
      C("ريان فاضل", "0781 222 3344", "social", 65, 18),
      C("مريم الزيدي", "0750 888 5522", "walk", 50, 27, "تعاني من حب الشباب — متابعة أسبوعية."),
      C("آيات جاسم", "0771 100 2003", "ads", 40, 9),
      C("نور علي", "0782 345 6789", "ref", 30, 15),
      C("سجاد كريم", "0770 909 1010", "walk", 25, 6, "عميل ليزر — 6 جلسات."),
      C("فارس لطيف", "0751 444 5566", "social", 15, 4),
      C("بشار النعيمي", "0772 777 1234", "ref", 8, 0, "جديد — استشارة بروتين.")
    ];

    /* -- موظفون: حضور آخر 7 أيام -- */
    const staffIds = state.staff.map(s => s.id);
    state.attendance = [];
    for (let i = 1; i <= 7; i++) {
      staffIds.forEach(sid => {
        if (i === 5 && Math.random() < .4) return;
        state.attendance.push({
          id: uid("at"), sid, d: day(-i),
          in: day(-i) + 9 * H + Math.floor(Math.random() * 20) * 60000,
          out: day(-i) + 17 * H + Math.floor(Math.random() * 40) * 60000,
          note: ""
        });
      });
    }

    /* -- مواعيد وفواتير -- */
    const sv = i => state.services[i];
    const mkAppt = (ci, si, extraSv, stId, offDay, hour, status) => {
      const s = sv(si);
      const items = [{ ref: s.id, name: s.name, price: s.price }];
      (extraSv || []).forEach(j => { const e = sv(j); items.push({ ref: e.id, name: e.name, price: e.price }); });
      const price = items.reduce((t, i2) => t + i2.price, 0);
      const start = day(offDay) + hour * H;
      return {
        id: uid("ap"), cid: state.clients[ci].id, sid: stId, items,
        start, dur: Math.max(s.dur, 45), status, price, notes: "", invoiceId: null
      };
    };
    state.appointments = [
      mkAppt(0, 0, [17], staffIds[1], -14, 11, "done"),
      mkAppt(2, 1, null, staffIds[2], -12, 13, "done"),
      mkAppt(1, 3, null, staffIds[1], -10, 10, "done"),
      mkAppt(4, 13, [14], staffIds[2], -8, 16, "done"),
      mkAppt(3, 6, null, staffIds[0], -7, 12, "done"),
      mkAppt(5, 4, null, staffIds[2], -5, 14, "done"),
      mkAppt(0, 7, null, staffIds[0], -3, 11, "done"),
      mkAppt(6, 15, null, staffIds[3], -2, 15, "done"),
      mkAppt(2, 2, null, staffIds[1], -1, 10, "done"),
      mkAppt(1, 5, null, staffIds[1], 0, 10, "booked"),
      mkAppt(7, 17, null, staffIds[0], 0, 12, "booked"),
      mkAppt(3, 8, [7], staffIds[0], 0, 15, "wait"),
      mkAppt(4, 13, null, staffIds[2], 1, 11, "booked"),
      mkAppt(5, 3, null, staffIds[1], 1, 13, "booked"),
      mkAppt(6, 9, null, staffIds[2], 2, 14, "booked"),
      mkAppt(0, 10, null, staffIds[1], 3, 16, "booked"),
      mkAppt(2, 11, null, staffIds[2], 4, 12, "wait"),
      mkAppt(1, 12, null, staffIds[2], 6, 15, "booked")
    ];

    /* فواتير للمواعيد المنتهية */
    state.appointments.filter(a => a.status === "done").forEach((a, i) => {
      const disc = i % 3 === 0 ? Math.round(a.price * 0.1) : 0;
      const inv = mkInvoice(state.clients.findIndex(c => c.id === a.cid),
        a.items.map(it => ({ type: "service", ref: it.ref, name: it.name, qty: 1, price: it.price })),
        a.start, disc, i % 4 === 0 ? "pos" : "cash", a.sid);
      inv.apptId = a.id;
      state.invoices.push(inv);
      a.invoiceId = inv.id;
      const c = state.clients.find(x => x.id === a.cid);
      if (c) c.points += Math.floor((inv.total - disc) / state.settings.pointsPer);
    });

    /* -- مصروفات -- */
    state.expenses = [
      { id: uid("ex"), d: day(-28), cat: "rent", amount: 1500000, note: "إيجار المحل — الشهر" },
      { id: uid("ex"), d: day(-26), cat: "supplies", amount: 850000, note: "طلبية مواد عناية" },
      { id: uid("ex"), d: day(-20), cat: "marketing", amount: 400000, note: "إعلان إنستغرام" },
      { id: uid("ex"), d: day(-14), cat: "utilities", amount: 220000, note: "كهرباء وماء" },
      { id: uid("ex"), d: day(-6), cat: "supplies", amount: 1200000, note: "أمبولات بوتوكس" },
      { id: uid("ex"), d: day(-2), cat: "maint", amount: 150000, note: "صيانة جهاز ليزر" }
    ];

    state.activity = [
      { t: "أُنشئت فاتورة #INV-1001", d: now - 2 * D },
      { t: "حُجز موعد جديد لـ مريم الزيدي", d: now - 1 * D },
      { t: "تم إنهاء موعد «تنظيف عميق للوجه»", d: now - 1 * D - 3 * H },
      { t: "سُجّل مصروف «صيانة جهاز ليزر»", d: now - 2 * D }
    ];
    save();
  }

  /* بناء فاتورة (يُستخدم في البذرة والإنشاء اليدوي) */
  function mkInvoice(ci, items, dateTs, discount = 0, method = "cash", staffId = null) {
    const subtotal = items.reduce((t, it) => t + it.price * it.qty, 0);
    const taxRate = state.settings.tax || 0;
    const afterDisc = Math.max(0, subtotal - discount);
    const tax = Math.round(afterDisc * taxRate / 100);
    const total = afterDisc + tax;
    const no = state.counters.invoice++;
    return {
      id: uid("inv"), no: "INV-" + no, cid: ci >= 0 ? state.clients[ci].id : null,
      date: dateTs, items, subtotal, discount, tax, total,
      method, staffId, rate: state.settings.rate, points: Math.floor(total / state.settings.pointsPer)
    };
  }

  /* ================= API ================= */
  return {
    get: () => state, load, save, uid, log, mkInvoice,
    export: () => JSON.stringify(state, null, 2),
    import(obj) {
      if (!obj || typeof obj !== "object") throw new Error("ملف غير صالح");
      if (!("clients" in obj) && !("services" in obj)) throw new Error("ملف نسخة احتياطية غير صحيح");
      state = Object.assign(defaults(), obj);
      state.settings = Object.assign(defaults().settings, state.settings || {});
      if (obj.settings && !obj.settings.faceV2 && state.settings.theme === "dark") state.settings.theme = "salon";
      state.settings.faceV2 = 1;
      save();
    },
    reset() { state = defaults(); save(); },

    /* ---- مساعدات ---- */
    getClient: id => state.clients.find(c => c.id === id),
    getStaff: id => state.staff.find(s => s.id === id),
    getService: id => state.services.find(s => s.id === id),
    getProduct: id => state.products.find(p => p.id === id),
    getInvoice: id => state.invoices.find(i => i.id === id),
    getAppt: id => state.appointments.find(a => a.id === id),
    isLow: p => p.qty <= p.min,
    nextInvoiceNo: () => "INV-" + state.counters.invoice,

    /* رصيد منتج (من الحركات) */
    productQty(pid) {
      return state.stock.filter(m => m.pid === pid)
        .reduce((t, m) => t + (m.type === "in" ? m.qty : -m.qty), 0);
    },
    addMove(pid, type, qty, note) {
      state.stock.push({ id: uid("mv"), pid, type, qty: Math.abs(qty), d: Date.now(), note: note || "" });
      const p = this.getProduct(pid);
      if (p) p.qty = this.productQty(pid);
    },

    /* عملات وتنسيق */
    money(iqd, cur) {
      const c = cur || state.settings.currency || "IQD";
      const meta = CURRENCIES[c] || CURRENCIES.IQD;
      const v = c === "USD" ? iqd / (state.settings.rate || 1310) : iqd;
      return v.toLocaleString("en-US", { minimumFractionDigits: meta.dp, maximumFractionDigits: meta.dp }) + " " + meta.sym;
    },

    /* عملاء: إحصاءات */
    clientStats(cid) {
      const invs = state.invoices.filter(i => i.cid === cid);
      const appts = state.appointments.filter(a => a.cid === cid);
      return {
        invoices: invs,
        appts,
        spent: invs.reduce((t, i) => t + i.total, 0),
        visits: appts.filter(a => a.status === "done").length,
        last: invs.length ? invs.map(i => i.date).sort((a, b) => b - a)[0] : null
      };
    },

    /* فترة */
    inRange(t, from, to) { return t >= from && t < to; },
    rangeThisMonth() {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      const from = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      return { from, to: from + 32 * 86400000 };
    },
    rangeDays(n) {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      return { from: d.getTime() - (n - 1) * 86400000, to: d.getTime() + 86400000 };
    }
  };
})();
