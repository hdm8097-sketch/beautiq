/* =========================================================
   BeautiQ — أدوات الواجهة (Toast / Modal / Drawer / Charts / Print)
   ========================================================= */
const UI = (() => {

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- Toast ---------- */
  function toast(msg, type = "ok") {
    const el = document.createElement("div");
    el.className = "toast " + (type === "ok" ? "" : type);
    el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(-20px)"; }, 2600);
    setTimeout(() => el.remove(), 3000);
  }

  /* ---------- Modal ---------- */
  function modal({ title, body, saveText = "حفظ", cancelText = "إلغاء", onSave: cb, wide = false, hideSave = false }) {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = body;
    $("#modalFoot").innerHTML = hideSave
      ? `<button class="btn btn-soft" data-x>إغلاق</button>`
      : `<button class="btn btn-soft" data-x>${esc(cancelText)}</button>
         <button class="btn btn-primary" data-save>${esc(saveText)}</button>`;
    $("#modal").style.width = wide ? "min(980px,100%)" : "";
    window.__modalSave = cb || null;
    $("#modalBackdrop").hidden = false;
    document.body.style.overflow = "hidden";
    const first = $("#modalBody input, #modalBody select, #modalBody textarea");
    if (first) setTimeout(() => first.focus(), 60);
  }
  function closeModal() {
    $("#modalBackdrop").hidden = true;
    document.body.style.overflow = "";
    window.__modalSave = null;
  }

  /* ---------- Drawer ---------- */
  function drawer(title, body) {
    $("#drawerTitle").innerHTML = title;
    $("#drawerBody").innerHTML = body;
    $("#drawerBackdrop").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeDrawer() {
    $("#drawerBackdrop").hidden = true;
    document.body.style.overflow = "";
  }

  /* ---------- Confirm ---------- */
  function confirm(msg, onYes, danger = true) {
    modal({
      title: "تأكيد",
      body: `<p style="font-size:14.5px;line-height:1.7">${msg}</p>`,
      saveText: "نعم، متابعة",
      onSave: () => { closeModal(); onYes && onYes(); }
    });
    if (danger) $("#modalFoot [data-save]").className = "btn btn-danger";
  }

  /* ---------- Small renderers ---------- */
  const tag = (txt, cls = "") => `<span class="tag ${cls}">${esc(txt)}</span>`;
  const st  = k => {
    const s = APPT_STATUS[k] || APPT_STATUS.booked;
    return `<span class="st ${s.cls}">${s.ar}</span>`;
  };
  const initials = n => (n || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("");
  const grad = id => "g" + (Math.abs(hash(id)) % 5 + 1);
  function hash(s) { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i); return h; }

  const fmtDate = t => new Date(t).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
  const fmtDay  = t => new Date(t).toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const fmtTime = t => new Date(t).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dayKey  = t => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const today   = () => dayKey(Date.now());
  const monthAr = m => new Date(2024, m, 1).toLocaleDateString("ar-EG", { month: "long" });
  const money   = (v, cur) => Store.money(v || 0, cur);
  const num     = v => (v || 0).toLocaleString("en-US");

  function empty(icon, title, sub, btn) {
    return `<div class="empty"><div class="e-ico">${icon}</div><h4>${esc(title)}</h4>
      <p>${esc(sub)}</p>${btn || ""}</div>`;
  }

  /* ---------- Charts (SVG, offline) ---------- */
  const fv = v => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + "M"
             : Math.abs(v) >= 1e3 ? Math.round(v / 1e3) + "k" : v;

  function lineChart(values, opts = {}) {
    const w = 520, h = 200, pad = 32;
    if (!values.length) return `<p class="muted">لا توجد بيانات كافية بعد.</p>`;
    const min = Math.min(...values), max = Math.max(...values);
    const span = (max - min) || 1;
    const xs = i => pad + i * ((w - pad * 2) / Math.max(values.length - 1, 1));
    const ys = v => h - pad - ((v - min) / span) * (h - pad * 2);
    const pts = values.map((v, i) => `${xs(i)},${ys(v)}`).join(" ");
    let grid = "", labels = "";
    for (let g = 0; g <= 3; g++) {
      const y = pad + g * ((h - pad * 2) / 3);
      grid += `<line class="gl" x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}"/>`;
      const val = Math.round(max - g * (span / 3));
      labels += `<text x="4" y="${y + 3}">${opts.short ? fv(val) : val}</text>`;
    }
    const dots = values.map((v, i) => `<circle class="pt" cx="${xs(i)}" cy="${ys(v)}" r="4"><title>${v}</title></circle>`).join("");
    const xlab = (opts.labels || []).map((l, i) =>
      `<text x="${xs(i)}" y="${h - 8}" text-anchor="middle">${esc(String(l).slice(0, 7))}</text>`).join("");
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      ${grid}${labels}<polyline class="ln" points="${pts}"/>${dots}${xlab}
      ${opts.unit ? `<text x="${w - pad}" y="14" text-anchor="end">${esc(opts.unit)}</text>` : ""}
    </svg>`;
  }

  function barChart(items) {
    if (!items.length) return `<p class="muted">لا توجد بيانات.</p>`;
    const w = 520, h = 200, pad = 34;
    const grouped = items.some(i => i.v2 != null);
    const max = Math.max(...items.map(i => Math.max(i.v || 0, i.v2 || 0))) || 1;
    const bw = (w - pad * 2) / items.length;
    let bars = "", labels = "";
    items.forEach((it, i) => {
      const slot = pad + i * bw;
      const bh = ((it.v || 0) / max) * (h - pad * 2);
      if (grouped) {
        const bh2 = ((it.v2 || 0) / max) * (h - pad * 2);
        const cw = bw * 0.30;
        const x1 = slot + bw * 0.12, x2 = slot + bw * 0.56;
        bars += `<rect x="${x1}" y="${h - pad - bh}" width="${cw}" height="${bh}" rx="5"
                   fill="url(#g1)"><title>${esc(it.l)}: ${it.v}</title></rect>`;
        bars += `<rect x="${x2}" y="${h - pad - bh2}" width="${cw}" height="${bh2}" rx="5"
                   fill="url(#g2)"><title>${esc(it.l)}: ${it.v2}</title></rect>`;
        labels += `<text x="${slot + bw / 2}" y="${h - pad - Math.max(bh, bh2) - 6}" text-anchor="middle"
                   style="fill:var(--brand2)">${fv(it.v)}</text>`;
      } else {
        const x = slot + bw * 0.18;
        bars += `<rect x="${x}" y="${h - pad - bh}" width="${bw * 0.64}" height="${bh}" rx="5"
                   fill="url(#g1)"><title>${esc(it.l)}: ${it.v}</title></rect>`;
        labels += `<text x="${x + bw * 0.32}" y="${h - pad - bh - 6}" text-anchor="middle"
                   style="fill:var(--brand2)">${fv(it.v)}</text>`;
      }
      labels += `<text x="${slot + bw / 2}" y="${h - pad + 15}" text-anchor="middle">${esc(it.l)}</text>`;
    });
    let gl = "";
    for (let g = 0; g <= 3; g++) {
      const y = pad + g * ((h - pad * 2) / 3);
      gl += `<line class="gl" x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}"/>
             <text x="4" y="${y + 3}">${fv(Math.round(max - g * (max / 3)))}</text>`;
    }
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style="stop-color:var(--brand)"/><stop offset="100%" style="stop-color:var(--brand-deep2)"/>
        </linearGradient>
        <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style="stop-color:#f87171"/><stop offset="100%" style="stop-color:#dc2626"/>
        </linearGradient>
      </defs>${gl}${bars}${labels}</svg>`;
  }

  function ring(pct, color = "var(--brand)") {
    const r = 42, c = 2 * Math.PI * r;
    const off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
    return `<svg width="104" height="104" viewBox="0 0 104 104">
      <circle cx="52" cy="52" r="${r}" fill="none" style="stroke:var(--line)" stroke-width="11"/>
      <circle cx="52" cy="52" r="${r}" fill="none" stroke="${color}" stroke-width="11"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"
        transform="rotate(-90 52 52)"/>
      <text x="52" y="57" text-anchor="middle" style="fill:var(--txt)" font-size="20" font-weight="800">${Math.round(pct)}%</text>
    </svg>`;
  }

  /* ---------- Print ---------- */
  function print(html) {
    $("#printArea").innerHTML = html;
    setTimeout(() => window.print(), 60);
  }
  function printFooter() {
    const s = Store.get().settings;
    return `<div class="p-ft">${esc(s.center || "")} ${s.phone ? "· " + esc(s.phone) : ""}
      ${s.address ? "· " + esc(s.address) : ""} · صدر بواسطة BeautiQ — ${new Date().toLocaleDateString("ar-EG")}</div>`;
  }
  const printHead = (title, sub) => `
    <h1>${esc(title)}</h1>
    <div class="p-sub">${esc(sub || "")} — ${esc(Store.get().settings.center || "")} · ${new Date().toLocaleDateString("ar-EG")}</div>`;

  return { esc, $, $$, toast, modal, closeModal, drawer, closeDrawer, confirm, tag, st,
           initials, grad, fmtDate, fmtDay, fmtTime, dayKey, today, monthAr, money, num,
           empty, lineChart, barChart, ring, print, printFooter, printHead, hash };
})();
