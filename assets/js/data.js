/* =========================================================
   BeautiQ — بيانات مرجعية (تصنيفات / خدمات / مصروفات / حالات)
   ========================================================= */

/* فئات الخدمات */
const SERVICE_CATS = {
  face:     { ar: "عناية بالوجه",     en: "Facial" },
  laser:    { ar: "ليزر",             en: "Laser" },
  inject:   { ar: "حقن وتجميل",       en: "Injectables" },
  hair:    { ar: "شعر",              en: "Hair" },
  body:    { ar: "جسم وتنحيف",       en: "Body" },
  nail:    { ar: "أظافر",            en: "Nails" },
  dental:   { ar: "أسنان",            en: "Dental" },
  consult:  { ar: "استشارة",          en: "Consultation" },
  other:   { ar: "أخرى",             en: "Other" }
};

/* خدمات جاهزة (تُزرع أول مرة فقط) */
const SEED_SERVICES = [
  { cat: "face",    name: "تنظيف عميق للوجه",        price: 150000, dur: 60 },
  { cat: "face",    name: "ماسك هيدرافيشل",          price: 250000, dur: 75 },
  { cat: "face",    name: "تقنية بيكربونات",          price: 200000, dur: 60 },
  { cat: "laser",   name: "ليزر — مناطق صغيرة",       price: 100000, dur: 30 },
  { cat: "laser",   name: "ليزر — كامل الجسم",        price: 700000, dur: 120 },
  { cat: "laser",   name: "ليزر — الوجه",             price: 150000, dur: 45 },
  { cat: "inject",  name: "بوتوكس",                  price: 500000, dur: 45 },
  { cat: "inject",  name: "فيلر شفاه",               price: 650000, dur: 60 },
  { cat: "inject",  name: "مزالج (خزب)",             price: 120000, dur: 40 },
  { cat: "hair",    name: "بروتين كيراتين",           price: 400000, dur: 150 },
  { cat: "hair",    name: "علاج تساقط الشعر",         price: 300000, dur: 60 },
  { cat: "body",    name: "جلسات تنحيف (أبراج)",       price: 250000, dur: 60 },
  { cat: "body",    name: "مانيوال ترافنجر",          price: 180000, dur: 60 },
  { cat: "nail",    name: "مانيكير وبديكير",          price: 50000,  dur: 45 },
  { cat: "nail",    name: "تركيب أظافر جل",           price: 80000,  dur: 60 },
  { cat: "dental",  name: "تنظيف أسنان",              price: 100000, dur: 45 },
  { cat: "dental",  name: "تبييض ليزر",               price: 350000, dur: 60 },
  { cat: "consult", name: "استشارة طبيب تجميل",       price: 50000,  dur: 20 }
];

/* فئات المنتجات والمواد */
const PRODUCT_CATS = {
  skincare: { ar: "مستحضرات عناية", en: "Skincare" },
  consum:   { ar: "مواد استهلاكية", en: "Consumables" },
  inject:   { ar: "حقن وفيلر",     en: "Injectables" },
  laser:    { ar: "مواد الليزر",     en: "Laser supplies" },
  retail:   { ar: "منتجات بيع",     en: "Retail" },
  other:    { ar: "أخرى",           en: "Other" }
};

/* منتجات جاهزة (تُزرع أول مرة فقط) */
const SEED_PRODUCTS = [
  { name: "سيروم فيتامين C",        cat: "skincare", qty: 24, min: 6,  buy: 45000,  sell: 90000,  unit: "علبة" },
  { name: "كريم واقٍ شمسي SPF50",   cat: "skincare", qty: 18, min: 5,  buy: 55000,  sell: 110000, unit: "علبة" },
  { name: "غسول لطيف للوجه",        cat: "skincare", qty: 9,  min: 5,  buy: 30000,  sell: 60000,  unit: "علبة" },
  { name: "قفازات نيتريل (علبة)",   cat: "consum",   qty: 40, min: 10, buy: 8000,   sell: 15000,  unit: "علبة" },
  { name: "كمامات طبية",            cat: "consum",   qty: 5,  min: 8,  buy: 5000,   sell: 10000,  unit: "كرتون" },
  { name: "جل تخدير موضعي",         cat: "consum",   qty: 12, min: 4,  buy: 25000,  sell: 50000,  unit: "عبوة" },
  { name: "حقن بوتوكس 100 وحدة",    cat: "inject",   qty: 6,  min: 3,  buy: 350000, sell: 500000, unit: "أمبولة" },
  { name: "فيلر حمض الهيالورونيك",  cat: "inject",   qty: 4,  min: 3,  buy: 400000, sell: 650000, unit: "حقنة" },
  { name: "رؤوس أطراف الليزر",     cat: "laser",    qty: 30, min: 10, buy: 3000,   sell: 6000,   unit: "قطعة" },
  { name: "كريم ما بعد الليزر",     cat: "retail",   qty: 15, min: 5,  buy: 35000,  sell: 75000,  unit: "علبة" }
];

/* فئات المصروفات */
const EXPENSE_CATS = {
  rent:     { ar: "إيجار",         en: "Rent" },
  salaries: { ar: "رواتب",         en: "Salaries" },
  supplies: { ar: "مواد ولوازم",   en: "Supplies" },
  utilities:{ ar: "كهرباء وماء",   en: "Utilities" },
  marketing:{ ar: "تسويق وإعلان",  en: "Marketing" },
  maint:    { ar: "صيانة",         en: "Maintenance" },
  other:    { ar: "أخرى",          en: "Other" }
};

/* حالات الحجز */
const APPT_STATUS = {
  booked: { ar: "مؤكد",   en: "Confirmed", cls: "st-booked" },
  wait:   { ar: "بانتظار", en: "Pending",   cls: "st-wait" },
  done:   { ar: "منجز",   en: "Completed", cls: "st-done" },
  cancel: { ar: "ملغي",   en: "Cancelled", cls: "st-cancel" }
};

/* طرق الدفع */
const PAY_METHODS = {
  cash:  { ar: "نقدي",   en: "Cash" },
  pos:   { ar: "شبكة",   en: "Card" },
  transfer: { ar: "تحويل", en: "Transfer" },
  credit:{ ar: "آجل",    en: "Credit" }
};

/* العملات */
const CURRENCIES = {
  IQD: { ar: "دينار عراقي", en: "IQD", sym: "د.ع", dp: 0 },
  USD: { ar: "دولار أمريكي", en: "USD", sym: "$",   dp: 2 }
};

/* مسميات الموظفين */
const ROLES = {
  doctor:    { ar: "طبيب/طبيبة",        en: "Doctor" },
  therapist: { ar: "أخصائي/ة تجميل",    en: "Therapist" },
  dentist:   { ar: "طبيب أسنان",        en: "Dentist" },
  nurse:     { ar: "ممرض/ة",            en: "Nurse" },
  reception: { ar: "استقبال",           en: "Reception" },
  admin:     { ar: "مدير/ة",            en: "Manager" },
  other:     { ar: "أخرى",              en: "Other" }
};

/* الصلاحيات */
const PERMS = {
  clients:     "العملاء",
  appointments:"المواعيد",
  services:    "الخدمات",
  inventory:   "المخزون",
  finance:     "المالية والفواتير",
  employees:   "الموظفين",
  reports:     "التقارير",
  settings:    "الإعدادات"
};

/* مصادر العملاء */
const CLIENT_SOURCES = {
  walk:    { ar: "مباشر",        en: "Walk-in" },
  social:  { ar: "سوشيال ميديا", en: "Social" },
  ref:     { ar: "توصية عميل",   en: "Referral" },
  ads:     { ar: "إعلان",        en: "Ads" },
  other:   { ar: "أخرى",         en: "Other" }
};
