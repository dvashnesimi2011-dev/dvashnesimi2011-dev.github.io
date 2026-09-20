/* ==========================================================================
   הסטודיו של תמימה — נתוני דמו (Mock Data, ללא באקאנד)
   ========================================================================== */

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
function fmtDate(d) {
  return `${d.getDate()} ב${MONTH_NAMES[d.getMonth()]}`;
}
function fmtDateShort(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}
function daysBetween(a, b) {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / 86400000);
}

const TODAY = new Date();

/* --- זרימת לקוח: סדנת קרמיקה ---
   פרטים אמיתיים מהרישום בבסלון (basalon.co.il) — כולל מחירון הקבוצה
   בפועל, שהוא תמחור מדורג ולא מחיר-לאיש קווי. */
const WORKSHOP = {
  title: 'סדנת קרמיקה פרטית בסטודיו של תמימה',
  subtitle: 'עבודת יד ואובניים · כל אחד/ת יוצר/ת שני כלים',
  duration: '2 שעות',
  minParticipants: 2,
  maxParticipants: 6, // תקרת ההזמנה העצמאית המקוונת (מחירון בסלון). קבוצות עד 12 קיימות, אך מתואמות ידנית מול תמימה בוואטסאפ/אינסטגרם — ראו קובץ הדיסקברי.
  priceTiers: { 2: 680, 3: 900, 4: 1200, 5: 1500, 6: 1800 },
  cancellationHours: 48,
  reviewCount: 27,
  reviewRating: 5,
  location: 'דרך בלפור, גבעת רם, ירושלים',
  pickupNote: 'הכלים עוברים ייבוש, שריפה וזיגוג בסטודיו — מוכנים לאיסוף (או משלוח בתוספת תשלום) כעבור כחודש.',
};

function workshopPrice(participants) {
  return WORKSHOP.priceTiers[participants] || WORKSHOP.priceTiers[WORKSHOP.maxParticipants];
}

/* חלון הזמנה של 4 ימים קדימה (בהתאם למה שנבדק בדמו, ראו קובץ 04) */
const AVAILABILITY = [
  { offset: 0, slots: ['17:00', '19:30'] },
  { offset: 1, slots: ['10:00', '16:00', '18:30', '20:30'] },
  { offset: 2, slots: [] }, // יום ללא זמינות — להדגמת מסך "אין שעות פנויות"
  { offset: 3, slots: ['09:30', '11:00', '17:30'] },
].map(d => ({
  date: addDays(TODAY, d.offset),
  offset: d.offset,
  slots: d.slots,
}));

/* משבצות "חלופיות" שמוצגות ב-Slot Picker כשמשבצת שנבחרה כבר נתפסה */
function nextAvailableSlots(excludeOffset, excludeTime, count = 3) {
  const out = [];
  for (const day of AVAILABILITY) {
    for (const t of day.slots) {
      if (day.offset === excludeOffset && t === excludeTime) continue;
      out.push({ date: day.date, offset: day.offset, time: t });
      if (out.length >= count) return out;
    }
  }
  return out;
}

/* --- אפליקציית סטודנטים: תלמידה לדוגמה --- */
const CURRENT_STUDENT = {
  name: 'נועה כהן',
  phone: '050-1234567',
  absencesThisMonth: 0,
  maxAbsencesPerMonth: 1,
  paymentStatus: 'שולם',
  nextLesson: { date: addDays(TODAY, 2), time: '17:30', teacher: 'תמימה' },
  packageProgress: { used: 2, total: 4 },
};

/* 17:30 — אחד מארבעת המועדים הקבועים של קורס הקרמיקה (ראשון/שני/שלישי ערב
   17:30–20:00, או שני בבוקר 9:30–12:00). נועה רשומה למסלול הערב. */
const MY_LESSONS = [
  { date: addDays(TODAY, 2), time: '17:30', status: 'upcoming' },
  { date: addDays(TODAY, 9), time: '17:30', status: 'upcoming' },
  { date: addDays(TODAY, 16), time: '17:30', status: 'upcoming' },
  { date: addDays(TODAY, -5), time: '17:30', status: 'done' },
  { date: addDays(TODAY, -12), time: '17:30', status: 'done' },
  { date: addDays(TODAY, -19), time: '17:30', status: 'missed-late' },
  { date: addDays(TODAY, -26), time: '17:30', status: 'done' },
];

/* 800 ₪ למחזור של 4 שיעורים (כולל חומרים ושריפה), תשלום מראש בהעברה בנקאית */
const MY_PAYMENTS = [
  { date: addDays(TODAY, -3), amount: 800, method: 'הוראת קבע', status: 'שולם', doc: 'חשבונית + קבלה #4821' },
  { date: addDays(TODAY, -31), amount: 800, method: 'הוראת קבע', status: 'שולם', doc: 'חשבונית + קבלה #4715' },
  { date: addDays(TODAY, -59), amount: 800, method: 'כרטיס אשראי', status: 'שולם', doc: 'חשבונית + קבלה #4602' },
];

/* מועדי השלמה זמינים בחודש התוקף (לביטול עם 24h+ הודעה) */
function makeupOptions() {
  return [
    { date: addDays(TODAY, 4), time: '17:00' },
    { date: addDays(TODAY, 6), time: '19:30' },
    { date: addDays(TODAY, 11), time: '18:00' },
  ];
}

/* --- צד ניהול: דשבורד --- */
const ADMIN_KPI = {
  monthRevenue: 18450,
  activeStudents: 15,
  workshopsThisMonth: 15, // כ-15 בחודש, גמיש (ראו קובץ הדיסקברי)
  studioCapacityToday: { used: 4, total: 6 }, // 6 אובניים בסך הכל בסטודיו (ראו קובץ 00) — לא 12
};

/* בסלון גובה 20% מהסכום שנמשך מהארנק על סדנאות שהגיעו דרכם (ראו קובץ
   הדיסקברי) — "עלות שיווק" נגזרת מהעמלה הזו, לא מספר קבוע/מומצא.
   מחושבת ב-app.js מתוך state.adminWorkshops (source === 'בסלון'). */
const BASALON_FEE_RATE = 0.20;

/* --- צד ניהול: מלאי חומרים ---
   הצורך האמיתי (ראו קובץ הדיסקברי): "המערכת תחשב ותתריע בזמן אמת על
   כמויות החומרים בסטודיו" — כי תמימה לעיתים מכינה חומר בכמות גבוהה או
   נמוכה מדי לשיעור. usagePerParticipant הוא אומדן צריכה ליוצר/ת אחד/ת;
   הצפי בפועל נגזר ב-app.js ממספר המשתתפים בסדנאות הקרובות שכבר נקבעו. */
const ADMIN_MATERIALS = [
  { id: 1, name: 'חימר', unit: 'ק"ג', stock: 30, usagePerParticipant: 1.4 },
  { id: 2, name: 'זיגוג שקוף', unit: 'ליטר', stock: 3.5, usagePerParticipant: 0.12 },
  { id: 3, name: 'זיגוג מרווה', unit: 'ליטר', stock: 0.8, usagePerParticipant: 0.12 },
  { id: 4, name: 'זיגוג טורקיז', unit: 'ליטר', stock: 2.2, usagePerParticipant: 0.12 },
];

/* הזמנות חוזרות שתמימה ביצעה בפועל מול ספק — פעולה חיצונית אמיתית שאי
   אפשר לגזור מנתוני הזמנות (בניגוד לצריכה, שכן נגזרת מסדנאות שהתקיימו —
   ראו getInventoryHistory ב-app.js). מוצג יחד עם הצריכה הנגזרת בלוח
   "תנועות מלאי אחרונות", כדי שיהיה ברור שהמלאי הנוכחי הוא תוצאה של שני
   הכיוונים ולא רק מספר קבוע שהוקלד. */
const ADMIN_RESTOCKS = [
  { date: addDays(TODAY, -6), materialId: 1, qty: 25, note: 'הזמנה חוזרת מספק החימר' },
  { date: addDays(TODAY, -14), materialId: 2, qty: 2, note: 'הזמנה חוזרת זיגוגים' },
];

/* אין כאן רשימת "ממתין לך עכשיו" נפרדת בכוונה — היא נגזרת ב-app.js מתוך
   ADMIN_STUDENTS ו-state.adminWorkshops, כדי שלא תוכל להתפצל מהמקור האמיתי
   (זה בדיוק המקום שבו נתונים כפולים "נשברים" כשמחברים באק-אנד אמיתי). */

/* שיעורים קבועים שחלים היום — אין עדיין מודל נתונים נפרד לכל מופע שיעור
   בודד (בדיוק הפער שיומן שיעורים אמיתי בבאק-אנד יסגור). נשארים רשימה
   מפורשת קטנה ונפרדת; לוח "היום" המלא (ADMIN_TODAY) נבנה ב-app.js על ידי
   מיזוג הרשימה הזו עם הסדנאות של היום שנגזרות מ-ADMIN_WORKSHOPS — לא עוד
   העתק ידני שיכול להתפצל מהמקור (כמו שקרה כאן בעבר). */
const ADMIN_TODAY_LESSONS = [
  { time: '09:30', name: 'שיעור קבוע — עדן שרון', kind: 'שיעור', participants: 1 },
  { time: '17:30', name: 'שיעור קבוע — נועה כהן', kind: 'שיעור', participants: 1 },
];

/* amount לכל סדנה מחושב ממחירון הקבוצה האמיתי (workshopPrice), לא מלינארי */
const ADMIN_WORKSHOPS = [
  { id: 1, name: 'קבוצת גן ילדים — יום הולדת', date: addDays(TODAY, 0), time: '10:00', participants: 6, source: 'בסלון', receipt: 'manual', amount: workshopPrice(6) },
  { id: 2, name: 'זוג — יובל ומאיה', date: addDays(TODAY, 0), time: '18:30', participants: 2, source: 'וואטסאפ', receipt: 'auto', amount: workshopPrice(2) },
  { id: 3, name: 'משפחת אברג׳יל', date: addDays(TODAY, -1), time: '18:00', participants: 5, source: 'בסלון', receipt: 'manual', amount: workshopPrice(5) },
  { id: 4, name: 'רועי ודנה', date: addDays(TODAY, -1), time: '09:20', participants: 2, source: 'בסלון', receipt: 'manual', amount: workshopPrice(2) },
  { id: 5, name: 'ימי הולדת — קבוצת נריה', date: addDays(TODAY, 1), time: '17:00', participants: 4, source: 'וואטסאפ', receipt: 'auto', amount: workshopPrice(4) },
  { id: 6, name: 'קבוצת רווקות — שירה', date: addDays(TODAY, 3), time: '19:00', participants: 6, source: 'בסלון', receipt: 'pending', amount: workshopPrice(6) },
];

const ADMIN_STUDENTS = [
  { name: 'שירה לוי', status: 'ממתינה לתשלום', urgent: true, lessons: '3/4', absences: 0, phone: '050-2221111' },
  { name: 'נועה כהן', status: 'שולם', urgent: false, lessons: '2/4', absences: 0, phone: '050-1234567' },
  { name: 'עדן שרון', status: 'שולם', urgent: false, lessons: '1/4', absences: 1, phone: '050-3332222' },
  { name: 'יעל אבידור', status: 'שולם', urgent: false, lessons: '4/4', absences: 0, phone: '052-4443333' },
  { name: 'טל ברקוביץ', status: 'ממתין לתשלום', urgent: true, lessons: '0/4', absences: 0, phone: '054-5554444' },
  { name: 'מאיה גולן', status: 'שולם', urgent: false, lessons: '3/4', absences: 0, phone: '050-6665555' },
  { name: 'איתי נבון', status: 'שולם', urgent: false, lessons: '2/4', absences: 1, phone: '053-7776666' },
  { name: 'רותם שגיא', status: 'שולם', urgent: false, lessons: '1/4', absences: 0, phone: '050-8887777' },
  { name: 'דנה פרץ', status: 'שולם', urgent: false, lessons: '4/4', absences: 0, phone: '052-9998888' },
  { name: 'אור מזרחי', status: 'שולם', urgent: false, lessons: '2/4', absences: 0, phone: '054-1112222' },
  { name: 'ליה שרעבי', status: 'שולם', urgent: false, lessons: '3/4', absences: 0, phone: '050-3334444' },
  { name: 'גיא רוזן', status: 'שולם', urgent: false, lessons: '1/4', absences: 0, phone: '053-5556666' },
  { name: 'נעמי כץ', status: 'שולם', urgent: false, lessons: '4/4', absences: 1, phone: '050-7778888' },
  { name: 'עומר ששון', status: 'שולם', urgent: false, lessons: '2/4', absences: 0, phone: '052-9990000' },
  { name: 'הדר וייס', status: 'שולם', urgent: false, lessons: '3/4', absences: 0, phone: '054-1230000' },
];

/* לקבלה ידנית (סדנה ששולמה דרך בסלון) אין "מחיר קבוע" נפרד — משתמשים
   באותו מחירון מדורג של workshopPrice(), כי זה בדיוק המחירון שהסטודיו
   קובעת בעצמה (לא נשלף מבסלון, ראו קובץ 02). מסך עדכון מחירון נפרד טרם קיים. */
