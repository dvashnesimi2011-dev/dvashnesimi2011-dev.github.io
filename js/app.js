/* ==========================================================================
   הסטודיו של תמימה — לוגיקת דמו (Frontend בלבד, ללא באקאנד/API אמיתיים)
   ========================================================================== */

const HOLD_TOTAL_SECONDS = 180;   // "3 דקות" עסקית
const DEMO_SPEED = 12;            // מואץ פי 12 לצרכי הדגמה חיה (~15 שניות)
const WARNING_THRESHOLD = 30;     // שניות (בזמן עסקי) שבהן מוצגת אזהרה עדינה

const state = {
  currentApp: null,
  history: { client: [], admin: ['a-dashboard'], student: [] },
  client: { participants: 2, dayIndex: 0, time: null, holdInterval: null, holdRemaining: HOLD_TOTAL_SECONDS, holdExpired: false, leadName: 'דנה מזרחי', leadPhone: '054-7712345' },
  student: { cancelLesson: null, makeupDate: null },
  adminWorkshops: JSON.parse(JSON.stringify(ADMIN_WORKSHOPS.map(w => ({ ...w, date: w.date.toISOString() })))),
};
// restore Date objects (structured clone above serialized dates to strings)
state.adminWorkshops.forEach(w => (w.date = new Date(w.date)));

/* -------------------------------------------------------------------------- */
/* Curtain — רגע מותג קצר לפני החשיפה ל-Hub                                   */
/* -------------------------------------------------------------------------- */
(function initCurtain() {
  const curtain = document.getElementById('curtain');
  if (!curtain) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { curtain.remove(); return; }

  let left = false;
  const leave = () => {
    if (left) return;
    left = true;
    curtain.classList.add('is-leaving');
    setTimeout(() => curtain.remove(), 680);
  };
  curtain.addEventListener('click', leave);
  curtain.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') leave(); });
  setTimeout(leave, 1350);
})();

/* -------------------------------------------------------------------------- */
/* Utils                                                                      */
/* -------------------------------------------------------------------------- */

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function participantsLabel(n) {
  return n === 1 ? 'משתתף/ת אחד/ת' : `${n} משתתפים`;
}

function mmss(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function countUp(el, target, opts = {}) {
  const prefix = opts.prefix || '';
  const suffix = opts.suffix || '';
  const dur = opts.dur || 700;
  const start = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = Math.round(target * eased);
    el.textContent = prefix + val.toLocaleString('he-IL') + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

let toastTimer = null;
function showToast(appId, message, icon = 'ti-check') {
  const toast = $(`#toast-${appId}`);
  if (!toast) return;
  toast.innerHTML = `<i class="ti ${icon}"></i><span>${message}</span>`;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

/* -------------------------------------------------------------------------- */
/* Router                                                                     */
/* -------------------------------------------------------------------------- */

function openApp(appId) {
  $all('.app-wrap').forEach(w => w.classList.remove('active'));
  const wrap = $(`#app-${appId}`);
  wrap.classList.add('active');
  document.getElementById('hub').style.display = 'none';
  state.currentApp = appId;

  if (appId === 'client') goToScreen('client', 'c1', 'forward', true);
  if (appId === 'student') goToScreen('student', 's1', 'forward', true);
  if (appId === 'admin') goToScreen('admin', 'a-dashboard', 'forward', true);
}

function backToHub() {
  $all('.app-wrap').forEach(w => w.classList.remove('active'));
  document.getElementById('hub').style.display = 'flex';
  stopHoldTimer();
}

function goToScreen(appId, screenId, dir = 'forward', isReset = false) {
  const root = $(`#app-${appId}`);
  const screens = $all('.screen', root);
  screens.forEach(s => { s.classList.remove('is-active', 'enter-forward', 'enter-back'); });
  const target = $(`[data-screen="${screenId}"]`, root);
  if (!target) return;
  target.classList.add('is-active', dir === 'back' ? 'enter-back' : 'enter-forward');
  target.scrollTop = 0;

  if (isReset) state.history[appId] = [screenId];
  else if (dir === 'forward') state.history[appId].push(screenId);
  // dir === 'back': history is adjusted by goBack() itself before this runs

  onScreenEnter(appId, screenId);
}

function goBack(appId) {
  const h = state.history[appId];
  if (h.length <= 1) return;
  h.pop(); // remove current screen
  const prev = h[h.length - 1]; // new current (already in history, stays)
  goToScreen(appId, prev, 'back');
}

function setStudentNavActive(screenId) {
  $all('#app-student .bottom-nav .nav-btn[data-nav]').forEach(el => el.classList.toggle('is-active', el.dataset.nav === screenId));
}

function onScreenEnter(appId, screenId) {
  if (appId === 'admin') setAdminNavActive(screenId);
  if (appId === 'student' && ['s1', 's2', 's6'].includes(screenId)) setStudentNavActive(screenId);
  if (appId === 'admin' && screenId === 'a-dashboard') { animateKpis(); renderAdminHome(); }
  if (appId === 'client' && screenId === 'c2') renderAvailability();
  if (appId === 'client' && screenId === 'c3') enterPaymentScreen();
  if (appId === 'client' && (screenId === 'c4' || screenId === 'c5')) renderWaCustomer();
  if (appId === 'client' && screenId === 'c6') renderWaTamima();
  if (appId === 'student' && screenId === 's2') renderMyLessons();
  if (appId === 'student' && screenId === 's3') renderCancelScreen();
  if (appId === 'student' && screenId === 's4') renderMakeupOptions();
  if (appId === 'admin' && screenId === 'a-workshops') renderAdminWorkshops();
  if (appId === 'admin' && screenId === 'a-students') renderAdminStudents();
  if (appId === 'admin' && screenId === 'a-receipt') renderReceiptPicker();
  if (appId === 'admin' && screenId === 'a-inventory') renderInventory();
}

/* -------------------------------------------------------------------------- */
/* HUB                                                                        */
/* -------------------------------------------------------------------------- */

$all('[data-open]').forEach(el => el.addEventListener('click', e => {
  window.__lastOpenOrigin = { x: e.clientX, y: e.clientY };
  openApp(el.dataset.open);
}));
$all('[data-exit]').forEach(el => el.addEventListener('click', () => backToHub()));
$all('[data-back]').forEach(el => el.addEventListener('click', () => goBack(el.dataset.back)));

/* -------------------------------------------------------------------------- */
/* CLIENT FLOW — 1. Activity type                                            */
/* -------------------------------------------------------------------------- */

$all('[data-activity]').forEach(el => {
  el.addEventListener('click', () => {
    const type = el.dataset.activity;
    if (type === 'workshop') { goToScreen('client', 'c2', 'forward'); return; }
    if (type === 'course') {
      showToast('client', 'קורס קרמיקה שנתי (אוק׳–יוני): ראשון/שני/שלישי 17:30–20:00 או שני בבוקר 9:30–12:00 · 800 ₪ לבלוק של 4 שיעורים. מתואם ישירות מול תמימה.', 'ti-info-circle');
    } else {
      showToast('client', 'מכירת כלי קרמיקה תיפתח בשלב הבא של הפרויקט.', 'ti-clock');
    }
  });
});

/* -------------------------------------------------------------------------- */
/* CLIENT FLOW — 2. Workshop + date                                          */
/* -------------------------------------------------------------------------- */

function renderAvailability() {
  const c = state.client;
  $('#participants-value').textContent = c.participants;
  const reviewEl = $('#review-badge');
  if (reviewEl) reviewEl.textContent = `${WORKSHOP.reviewRating.toFixed(1)} · ${WORKSHOP.reviewCount} ביקורות`;
  $('#stepper-minus').disabled = c.participants <= WORKSHOP.minParticipants;
  $('#stepper-plus').disabled = c.participants >= WORKSHOP.maxParticipants;

  const chipRow = $('#day-chip-row');
  chipRow.innerHTML = AVAILABILITY.map((d, i) => `
    <button class="chip ${i === c.dayIndex ? 'is-active' : ''}" data-day="${i}">
      <span class="chip-day">${i === 0 ? 'היום' : DAY_NAMES[d.date.getDay()]}</span>
      <span class="chip-date">${fmtDateShort(d.date)}</span>
    </button>`).join('');
  $all('[data-day]', chipRow).forEach(el => el.addEventListener('click', () => {
    c.dayIndex = Number(el.dataset.day);
    c.time = null;
    renderAvailability();
  }));

  const day = AVAILABILITY[c.dayIndex];
  const slotsWrap = $('#slots-wrap');
  if (day.slots.length === 0) {
    slotsWrap.innerHTML = `
      <div class="empty-hint">
        <i class="ti ti-calendar-off"></i>
        <p>אין שעות פנויות ל${fmtDate(day.date)}.<br>נסו לבחור יום אחר מהרשימה למעלה.</p>
      </div>`;
  } else {
    slotsWrap.innerHTML = `<div class="select-row-grid stagger-in" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">` +
      day.slots.map(t => `
        <button class="select-row ${c.time === t ? 'is-selected' : ''}" data-time="${t}" style="justify-content:center;">
          <span class="select-row-title" style="font-variant-numeric:tabular-nums;">${t}</span>
        </button>`).join('') + `</div>`;
    $all('[data-time]', slotsWrap).forEach(el => el.addEventListener('click', () => {
      c.time = el.dataset.time;
      renderAvailability();
    }));
  }

  $('#to-payment-btn').disabled = !c.time;
  $('#summary-price').textContent = `${workshopPrice(c.participants).toLocaleString('he-IL')} ₪`;
}

$('#stepper-minus')?.addEventListener('click', () => { state.client.participants = Math.max(WORKSHOP.minParticipants, state.client.participants - 1); renderAvailability(); });
$('#stepper-plus')?.addEventListener('click', () => { state.client.participants = Math.min(WORKSHOP.maxParticipants, state.client.participants + 1); renderAvailability(); });
$('#to-payment-btn')?.addEventListener('click', () => goToScreen('client', 'c3', 'forward'));

/* -------------------------------------------------------------------------- */
/* CLIENT FLOW — 3. Payment + hold timer + fallback slot picker              */
/* -------------------------------------------------------------------------- */

function stopHoldTimer() {
  clearInterval(state.client.holdInterval);
  state.client.holdInterval = null;
}

function enterPaymentScreen() {
  const c = state.client;
  const day = AVAILABILITY[c.dayIndex];
  $('#pay-summary-title').textContent = WORKSHOP.title;
  $('#pay-summary-when').textContent = `${fmtDate(day.date)} · ${c.time} · ${participantsLabel(c.participants)}`;
  $('#pay-summary-price').textContent = `${workshopPrice(c.participants).toLocaleString('he-IL')} ₪`;
  $('#pay-cancellation-hours').textContent = WORKSHOP.cancellationHours;
  $('#pay-duration').textContent = WORKSHOP.duration;
  $('#pay-subtitle').textContent = WORKSHOP.subtitle;
  $('#pay-location').textContent = WORKSHOP.location;

  c.holdRemaining = HOLD_TOTAL_SECONDS;
  c.holdExpired = false;
  stopHoldTimer();
  updateHoldBanner();
  $('#pay-btn').textContent = 'מעבר לתשלום מאובטח';
  $('#pay-btn').classList.remove('is-loading');

  c.holdInterval = setInterval(() => {
    c.holdRemaining -= DEMO_SPEED;
    if (c.holdRemaining <= 0) {
      c.holdRemaining = 0;
      c.holdExpired = true;
      stopHoldTimer();
    }
    updateHoldBanner();
  }, 1000);
}

function updateHoldBanner() {
  const c = state.client;
  const banner = $('#hold-banner');
  if (!banner) return;
  banner.classList.remove('is-warning', 'is-expired');
  if (c.holdExpired) {
    banner.classList.add('is-expired');
    banner.innerHTML = `<i class="ti ti-lock-open"></i> המשבצת שוחררה — הפרטים שלך עדיין שמורים בעגלה`;
  } else {
    if (c.holdRemaining <= WARNING_THRESHOLD) banner.classList.add('is-warning');
    banner.innerHTML = `<i class="ti ti-clock"></i> המשבצת שמורה לך עוד <span class="hold-time">${mmss(c.holdRemaining)}</span>`;
  }
}

$('#pay-btn')?.addEventListener('click', () => {
  const c = state.client;
  const btn = $('#pay-btn');
  if (c.holdExpired) {
    // סימולציה: המשבצת כבר נתפסה ע"י מישהו אחר → זרימת fallback
    btn.classList.add('is-loading');
    setTimeout(() => {
      btn.classList.remove('is-loading');
      openSlotPicker();
    }, 700);
    return;
  }
  btn.classList.add('is-loading');
  setTimeout(() => {
    btn.classList.remove('is-loading');
    stopHoldTimer();
    goToScreen('client', 'c4', 'forward');
  }, 900);
});

function openSlotPicker() {
  const c = state.client;
  const day = AVAILABILITY[c.dayIndex];
  showToast('client', 'המשבצת שבחרת אינה זמינה כעת, אך הפרטים שלך שמורים.', 'ti-alert-circle');
  const alts = nextAvailableSlots(day.offset, c.time, 3);
  const list = $('#slot-picker-list');
  list.innerHTML = alts.map((a, i) => `
    <button class="select-row" data-alt="${i}" style="margin-bottom:10px;">
      <span class="select-row-icon"><i class="ti ti-clock"></i></span>
      <span class="select-row-body">
        <span class="select-row-title">${fmtDate(a.date)}</span>
        <span class="select-row-sub">שעה ${a.time}</span>
      </span>
      <span class="select-row-check"><i class="ti ti-chevron-left"></i></span>
    </button>`).join('');
  $all('[data-alt]', list).forEach(el => el.addEventListener('click', () => {
    const a = alts[Number(el.dataset.alt)];
    c.dayIndex = a.offset;
    c.time = a.time;
    closeSlotPicker();
    showToast('client', 'המשבצת החדשה ננעלה לך ל-3 דקות', 'ti-lock');
    enterPaymentScreen();
  }));
  $('#slot-picker-overlay').classList.add('is-open');
}
function closeSlotPicker() { $('#slot-picker-overlay').classList.remove('is-open'); }
$('#slot-picker-overlay')?.addEventListener('click', e => { if (e.target.id === 'slot-picker-overlay') closeSlotPicker(); });

$('#c3-back-btn')?.addEventListener('click', () => { stopHoldTimer(); goBack('client'); });

/* -------------------------------------------------------------------------- */
/* CLIENT FLOW — 4/5/6. Confirmation + WhatsApp mocks                        */
/* -------------------------------------------------------------------------- */

$('#confirm-to-wa-customer')?.addEventListener('click', () => goToScreen('client', 'c5', 'forward'));
$('#wa-customer-next')?.addEventListener('click', () => goToScreen('client', 'c6', 'forward'));
$('#wa-tamima-restart')?.addEventListener('click', () => backToHub());

function renderWaCustomer() {
  const c = state.client;
  const day = AVAILABILITY[c.dayIndex];
  $('#confirm-title').textContent = WORKSHOP.title;
  $('#confirm-when').textContent = `${fmtDate(day.date)} · ${c.time}`;
  $('#confirm-price').textContent = `${workshopPrice(c.participants).toLocaleString('he-IL')} ₪`;
  const locEl = $('#confirm-location'); if (locEl) locEl.textContent = WORKSHOP.location;
  const pickupEl = $('#confirm-pickup-note'); if (pickupEl) pickupEl.textContent = WORKSHOP.pickupNote;
  $('#wa-customer-body').innerHTML = `
    <div class="wa-bubble">שלום ${c.leadName.split(' ')[0]}! ההזמנה שלך ל<b>${WORKSHOP.title}</b> אושרה.
      <br>${fmtDate(day.date)} בשעה ${c.time} · ${participantsLabel(c.participants)}.
      <br>מצורפות החשבונית והקבלה שלך. מתרגשים לראות אותך בסטודיו!
      <span class="wa-time">${c.time}</span></div>
    <div class="wa-bubble"><i class="ti ti-paperclip"></i> חשבונית + קבלה #${8800 + Math.floor(Math.random() * 90)} — ${workshopPrice(c.participants).toLocaleString('he-IL')} ₪
      <span class="wa-time">עכשיו</span></div>`;
}
function renderWaTamima() {
  const c = state.client;
  const day = AVAILABILITY[c.dayIndex];
  $('#wa-tamima-body').innerHTML = `
    <div class="wa-bubble"><i class="ti ti-confetti"></i> נסגרה סדנא חדשה!
      <br><b>${c.leadName}</b> · ${c.leadPhone}
      <br>${fmtDate(day.date)} בשעה ${c.time} · ${participantsLabel(c.participants)}
      <br>שולם במלואו דרך קישור התשלום.
      <span class="wa-time">עכשיו</span></div>`;
}

/* -------------------------------------------------------------------------- */
/* STUDENT APP — Home                                                        */
/* -------------------------------------------------------------------------- */

function renderStudentHome() {
  $('#student-name').textContent = CURRENT_STUDENT.name.split(' ')[0];
  $('#student-next-date').textContent = fmtDate(CURRENT_STUDENT.nextLesson.date);
  $('#student-next-time').textContent = CURRENT_STUDENT.nextLesson.time;
  $('#student-absences').textContent = `${CURRENT_STUDENT.absencesThisMonth}/${CURRENT_STUDENT.maxAbsencesPerMonth}`;
  $('#student-payment-status').textContent = CURRENT_STUDENT.paymentStatus;
  $('#student-pkg-used').textContent = CURRENT_STUDENT.packageProgress.used;
  $('#student-pkg-total').textContent = CURRENT_STUDENT.packageProgress.total;
  const pct = (CURRENT_STUDENT.packageProgress.used / CURRENT_STUDENT.packageProgress.total) * 100;
  $('#student-pkg-bar').style.width = pct + '%';
}
renderStudentHome();

/* -------------------------------------------------------------------------- */
/* STUDENT APP — My lessons                                                  */
/* -------------------------------------------------------------------------- */

const STATUS_LABEL = {
  upcoming: { text: 'קרוב', cls: 'tag-sage' },
  done: { text: 'התקיים', cls: 'tag-success' },
  'missed-late': { text: 'ביטול מאוחר', cls: 'tag-danger' },
};

function renderMyLessons() {
  const wrap = $('#lessons-list');
  wrap.innerHTML = MY_LESSONS.map((l, i) => {
    const st = STATUS_LABEL[l.status];
    return `
    <div class="select-row" style="cursor:default;">
      <span class="select-row-icon"><i class="ti ti-calendar-event"></i></span>
      <span class="select-row-body">
        <span class="select-row-title">${fmtDate(l.date)}</span>
        <span class="select-row-sub">שעה ${l.time}</span>
      </span>
      <span class="tag ${st.cls}">${st.text}</span>
      ${l.status === 'upcoming' ? `<button class="btn-text" data-cancel="${i}" style="color:var(--c-danger-text);">ביטול</button>` : ''}
    </div>`;
  }).join('');
  $all('[data-cancel]', wrap).forEach(el => el.addEventListener('click', () => {
    state.student.cancelLesson = MY_LESSONS[Number(el.dataset.cancel)];
    goToScreen('student', 's3', 'forward');
  }));
}

/* -------------------------------------------------------------------------- */
/* STUDENT APP — Cancel lesson (מדיניות מחושבת אוטומטית)                     */
/* -------------------------------------------------------------------------- */

$('[data-cancel-first]')?.addEventListener('click', () => {
  state.student.cancelLesson = MY_LESSONS.find(l => l.status === 'upcoming');
  goToScreen('student', 's3', 'forward');
});
$('[data-goto-policy]')?.addEventListener('click', () => goToScreen('student', 's7', 'forward'));

function hoursUntil(lesson) {
  const [h, m] = lesson.time.split(':').map(Number);
  const dt = new Date(lesson.date);
  dt.setHours(h, m, 0, 0);
  return (dt - new Date()) / 3600000;
}

function renderCancelScreen() {
  const l = state.student.cancelLesson;
  if (!l) return;
  $('#cancel-date').textContent = fmtDate(l.date);
  $('#cancel-time').textContent = l.time;
  const hrs = hoursUntil(l);
  const eligible = hrs >= 24;
  const box = $('#cancel-policy-box');
  if (eligible) {
    box.className = 'card';
    box.style.background = 'var(--c-success-bg)';
    box.style.borderColor = 'transparent';
    box.innerHTML = `<div style="display:flex;gap:10px;align-items:flex-start;color:var(--c-success-text);">
      <i class="ti ti-circle-check" style="font-size:20px;flex-shrink:0;"></i>
      <span>הביטול יזכה אותך בשיעור השלמה, בתוקף לחודש מהיום, בהתאם למקום פנוי.</span></div>`;
  } else {
    box.className = 'card';
    box.style.background = 'var(--c-danger-bg)';
    box.style.borderColor = 'transparent';
    box.innerHTML = `<div style="display:flex;gap:10px;align-items:flex-start;color:var(--c-danger-text);">
      <i class="ti ti-alert-triangle" style="font-size:20px;flex-shrink:0;"></i>
      <span>הביטול הוא בפחות מ-24 שעות מראש. בהתאם למדיניות הסטודיו, השיעור יחויב במלואו, ללא זיכוי או השלמה.</span></div>`;
  }
  state.student._eligible = eligible;
  $('#cancel-confirm-btn').dataset.eligible = eligible ? '1' : '0';
}

$('#cancel-confirm-btn')?.addEventListener('click', () => {
  const eligible = $('#cancel-confirm-btn').dataset.eligible === '1';
  $('#cancel-success-cta').style.display = eligible ? 'flex' : 'none';
  if (eligible) {
    const validUntil = addDays(new Date(), 30);
    $('#cancel-success-validity').textContent = `בתוקף עד ${fmtDateShort(validUntil)} · בהתאם למקום פנוי`;
  }
  $('#cancel-success-title').textContent = eligible ? 'הביטול בוצע' : 'הביטול נקלט';
  goToScreen('student', 's3-success', 'forward');
});

$('[data-goto-makeup]')?.addEventListener('click', () => goToScreen('student', 's4', 'forward'));
$('[data-cancel-done]')?.addEventListener('click', () => goToScreen('student', 's1', 'forward', true));

/* -------------------------------------------------------------------------- */
/* STUDENT APP — Makeup booking                                              */
/* -------------------------------------------------------------------------- */

function renderMakeupOptions() {
  const wrap = $('#makeup-list');
  const opts = makeupOptions();
  wrap.innerHTML = opts.map((o, i) => `
    <button class="select-row" data-makeup="${i}">
      <span class="select-row-icon"><i class="ti ti-calendar-event"></i></span>
      <span class="select-row-body">
        <span class="select-row-title">${fmtDate(o.date)}</span>
        <span class="select-row-sub">שעה ${o.time}</span>
      </span>
      <span class="select-row-check"><i class="ti ti-check"></i></span>
    </button>`).join('');
  $all('[data-makeup]', wrap).forEach(el => el.addEventListener('click', () => {
    state.student.makeupDate = opts[Number(el.dataset.makeup)];
    $('#makeup-confirm-date').textContent = fmtDate(state.student.makeupDate.date);
    $('#makeup-confirm-time').textContent = state.student.makeupDate.time;
    goToScreen('student', 's5', 'forward');
  }));
}
$('[data-makeup-done]')?.addEventListener('click', () => goToScreen('student', 's1', 'forward', true));

/* -------------------------------------------------------------------------- */
/* STUDENT APP — Payments                                                    */
/* -------------------------------------------------------------------------- */

(function renderPayments() {
  const wrap = $('#payments-list');
  if (!wrap) return;
  wrap.innerHTML = MY_PAYMENTS.map(p => `
    <div class="data-row" style="border-color:var(--c-border);">
      <span class="select-row-icon" style="width:38px;height:38px;font-size:16px;"><i class="ti ti-receipt"></i></span>
      <span class="select-row-body">
        <span class="select-row-title">${fmtDate(p.date)}</span>
        <span class="select-row-sub">${p.method} · ${p.doc}</span>
      </span>
      <span class="select-row-meta ltr-nums" style="text-align:left;font-weight:700;">${p.amount} ₪</span>
    </div>`).join('');
})();

/* -------------------------------------------------------------------------- */
/* STUDENT bottom nav                                                        */
/* -------------------------------------------------------------------------- */

$all('#app-student [data-nav]').forEach(el => el.addEventListener('click', () => {
  $all('#app-student .bottom-nav .nav-btn').forEach(b => b.classList.remove('is-active'));
  el.classList.add('is-active');
  goToScreen('student', el.dataset.nav, 'forward', true);
}));

/* -------------------------------------------------------------------------- */
/* ADMIN — nav + view toggle                                                 */
/* -------------------------------------------------------------------------- */

function setAdminNavActive(screenId) {
  $all('.admin-nav-item[data-nav]').forEach(el => el.classList.toggle('is-active', el.dataset.nav === screenId));
  $all('.admin-bottom-nav .nav-btn[data-nav]').forEach(el => el.classList.toggle('is-active', el.dataset.nav === screenId));
}
$all('#app-admin [data-nav]').forEach(el => el.addEventListener('click', () => goToScreen('admin', el.dataset.nav, 'forward', true)));

$('#admin-view-toggle')?.addEventListener('click', () => {
  const frame = $('#admin-frame');
  const isMobile = frame.classList.toggle('mobile-preview');
  $('#admin-view-toggle span').textContent = isMobile ? 'תצוגת דסקטופ' : 'תצוגת נייד';
  $('#admin-view-toggle i').className = isMobile ? 'ti ti-device-desktop' : 'ti ti-device-mobile';
});

/* -------------------------------------------------------------------------- */
/* ADMIN — Dashboard                                                         */
/* -------------------------------------------------------------------------- */

let kpiAnimated = false;
function animateKpis() {
  countUp($('#kpi-revenue'), ADMIN_KPI.monthRevenue, { suffix: ' ₪' });
  countUp($('#kpi-students'), ADMIN_KPI.activeStudents);
  countUp($('#kpi-workshops'), ADMIN_KPI.workshopsThisMonth);
  countUp($('#kpi-capacity'), ADMIN_KPI.studioCapacityToday.used, { suffix: ` / ${ADMIN_KPI.studioCapacityToday.total}` });
  countUp($('#kpi-marketing'), getMarketingCost(), { suffix: ' ₪' });
  renderCapacityDots();
  renderRevenueSplit();
}

/* ייצוג מוחשי של תפוסת הסטודיו — נקודה לכל אובניים אמיתי (לא רק "4/6"
   כטקסט), נגזר מאותו נתון שכבר מוצג ב-KPI עצמו. */
function renderCapacityDots() {
  const wrap = $('#kpi-capacity-dots');
  if (!wrap) return;
  const { used, total } = ADMIN_KPI.studioCapacityToday;
  wrap.innerHTML = Array.from({ length: total }, (_, i) =>
    `<span class="wheel-dot ${i < used ? 'is-used' : ''}"></span>`).join('');
}

/* פילוח בסלון/ישיר מתחת ל-KPI הראשי — נגזר מ-getWorkshopsSummary()
   (אותם נתוני state.adminWorkshops שכבר מוצגים במסך הסדנאות), לא גרף
   היסטוריה מומצא שאין מאחוריו נתון אמיתי. */
function renderRevenueSplit() {
  const splitWrap = $('#kpi-revenue-split');
  const labelWrap = $('#kpi-revenue-split-label');
  if (!splitWrap || !labelWrap) return;
  const { total, basalon, direct } = getWorkshopsSummary();
  if (total <= 0) { splitWrap.innerHTML = ''; labelWrap.textContent = ''; return; }
  const basalonPct = Math.round((basalon / total) * 100);
  splitWrap.innerHTML = `<span class="kpi-split-seg" style="width:${basalonPct}%"></span><span class="kpi-split-seg is-direct" style="width:${100 - basalonPct}%"></span>`;
  labelWrap.textContent = `${basalonPct}% מבסלון · ${100 - basalonPct}% ישיר, מתוך הסדנאות המוצגות`;
}

/* עלות השיווק נגזרת מהעמלה האמיתית שבסלון גובה (BASALON_FEE_RATE, ראו
   data.js) על סך ההכנסה מהסדנאות שמקורן בבסלון — לא מספר שהוקלד ידנית. */
function getMarketingCost() {
  const basalonRevenue = state.adminWorkshops
    .filter(w => w.source === 'בסלון')
    .reduce((sum, w) => sum + w.amount, 0);
  return Math.round(basalonRevenue * BASALON_FEE_RATE);
}

/* "ממתין לך עכשיו" נגזר בזמן אמת מ-ADMIN_STUDENTS ומ-state.adminWorkshops —
   לא מרשימה נפרדת שיכולה להתפצל מהמקור (למשל: לשכוח לקוח שממתין לתשלום,
   או להמשיך להציג סדנה שכבר הופקה לה קבלה). */
function getPendingActions() {
  const lessonPayments = ADMIN_STUDENTS.filter(s => s.urgent).map(s => ({
    type: 'payment', label: 'ממתין/ה לתשלום — בלוק שיעורים', name: s.name, when: '', urgent: true, phone: s.phone,
  }));
  const workshopPayments = state.adminWorkshops.filter(w => w.receipt === 'pending').map(w => ({
    type: 'payment', label: 'ממתין לתשלום — סדנה', name: w.name, when: `${fmtDate(w.date)}, ${w.time}`, urgent: true,
  }));
  const receipts = state.adminWorkshops.filter(w => w.receipt === 'manual').map(w => {
    const diff = daysBetween(w.date, TODAY);
    const when = diff === 0 ? `היום, ${w.time}` : diff === -1 ? `אתמול, ${w.time}` :
      diff < -1 ? `לפני ${-diff} ימים` : `${fmtDate(w.date)}, ${w.time}`;
    return { type: 'receipt', label: 'להפיק קבלה ידנית — סדנת בסלון', name: w.name, when, urgent: diff <= -1 };
  });
  return [...lessonPayments, ...workshopPayments, ...receipts];
}

/* לוח "היום" — ממזג את שיעורי-הקבע (ADMIN_TODAY_LESSONS, ראו data.js) עם
   הסדנאות של היום שנגזרות מ-state.adminWorkshops, כדי שסדנה שמזיזים או
   מוסיפים לא תצטרך עדכון ידני נוסף ברשימה נפרדת. */
function getTodaySchedule() {
  const workshopsToday = state.adminWorkshops
    .filter(w => daysBetween(TODAY, w.date) === 0)
    .map(w => ({ time: w.time, name: w.name, kind: 'סדנה', participants: w.participants }));
  return [...ADMIN_TODAY_LESSONS, ...workshopsToday].sort((a, b) => a.time.localeCompare(b.time));
}

function renderAdminHome() {
  const actions = getPendingActions();
  const pendingHtml = actions.map(p => `
      <div class="data-row">
        <span class="data-avatar"><i class="ti ${p.type === 'receipt' ? 'ti-receipt' : 'ti-credit-card'}"></i></span>
        <span class="data-row-body">
          <span class="data-row-title">${p.label}</span>
          <span class="data-row-sub">${p.name}${p.when ? ' · ' + p.when : ''}</span>
        </span>
        ${p.phone ? `<a class="icon-btn" href="tel:${p.phone}" aria-label="התקשרות ל${p.name}" style="width:34px;height:34px;font-size:15px;"><i class="ti ti-phone"></i></a>` : ''}
        ${p.urgent ? '<span class="tag tag-warning">דחוף</span>' : ''}
      </div>`).join('');
  const pendingWrap = $('#admin-pending-list');
  if (pendingWrap) pendingWrap.innerHTML = pendingHtml;
  const pendingWrapM = $('#admin-pending-list-m');
  if (pendingWrapM) pendingWrapM.innerHTML = pendingHtml;
  const countEl = $('#needs-attention-count');
  if (countEl) countEl.textContent = actions.length;

  const today = getTodaySchedule();
  const todayDetail = $('#admin-today-detail');
  if (todayDetail) {
    todayDetail.innerHTML = today.map(t => `
      <div class="data-row">
        <span class="data-avatar">${t.time}</span>
        <span class="data-row-body">
          <span class="data-row-title">${t.name}</span>
          <span class="data-row-sub">${t.kind} · ${participantsLabel(t.participants)}</span>
        </span>
      </div>`).join('');
  }
  const todayCompact = $('#admin-today-compact');
  if (todayCompact) {
    todayCompact.innerHTML = today.map(t => `
      <div class="data-row">
        <span class="data-avatar">${t.time}</span>
        <span class="data-row-body"><span class="data-row-title">${t.name}</span></span>
      </div>`).join('');
  }
}
renderAdminHome();

/* -------------------------------------------------------------------------- */
/* ADMIN — Workshops management                                              */
/* -------------------------------------------------------------------------- */

const RECEIPT_LABEL = {
  auto: { text: 'קבלה הופקה אוטומטית', cls: 'tag-success', icon: 'ti-bolt' },
  manual: { text: 'דורש קבלה ידנית', cls: 'tag-warning', icon: 'ti-hand-stop' },
  pending: { text: 'ממתין לתשלום', cls: 'tag-danger', icon: 'ti-hourglass' },
  done: { text: 'קבלה הופקה', cls: 'tag-success', icon: 'ti-check' },
};

/* מציג מאיפה בפועל מגיעה ההכנסה — לא רק "סך הכל", כי בסלון וישיר (ווצאפ/
   אינסטגרם) מתנהגים אחרת לגמרי (עמלת 20% מול כלום, אישור אוטומטי מול
   ידני) והפער הזה הוא בדיוק הסיפור העסקי שהמערכת אמורה לשקף. */
function getWorkshopsSummary() {
  const total = state.adminWorkshops.reduce((sum, w) => sum + w.amount, 0);
  const basalon = state.adminWorkshops.filter(w => w.source === 'בסלון').reduce((sum, w) => sum + w.amount, 0);
  return { total, basalon, direct: total - basalon };
}

function renderAdminWorkshops() {
  const wrap = $('#admin-workshops-list');
  $('#workshops-count').textContent = `· ${state.adminWorkshops.length} סה״כ`;

  const summary = getWorkshopsSummary();
  const totalEl = $('#wk-total-revenue'); if (totalEl) totalEl.textContent = `${summary.total.toLocaleString('he-IL')} ₪`;
  const basalonEl = $('#wk-basalon-revenue'); if (basalonEl) basalonEl.textContent = `${summary.basalon.toLocaleString('he-IL')} ₪`;
  const directEl = $('#wk-direct-revenue'); if (directEl) directEl.textContent = `${summary.direct.toLocaleString('he-IL')} ₪`;

  const clay = ADMIN_MATERIALS.find(m => m.name === 'חימר');
  const sorted = [...state.adminWorkshops].sort((a, b) => b.date - a.date);
  wrap.innerHTML = sorted.map(w => {
    const r = RECEIPT_LABEL[w.receipt];
    const clayEst = +(w.participants * clay.usagePerParticipant).toFixed(1);
    return `
    <div class="data-row">
      <span class="data-avatar"><i class="ti ti-users"></i></span>
      <span class="data-row-body">
        <span class="data-row-title">${w.name}</span>
        <span class="data-row-sub">${fmtDate(w.date)} · ${w.time} · ${participantsLabel(w.participants)} · ${w.source} · חימר משוער ${clayEst} ק"ג</span>
      </span>
      <span class="data-row-meta ltr-nums" style="font-weight:600;">${w.amount.toLocaleString('he-IL')} ₪</span>
      <span class="tag ${r.cls}"><i class="ti ${r.icon}"></i> ${r.text}</span>
    </div>`;
  }).join('');
}

/* -------------------------------------------------------------------------- */
/* ADMIN — Inventory / materials forecast                                    */
/* -------------------------------------------------------------------------- */

/* רק סדנאות שעוד לא קרו נכנסות לצפי — סדנה שכבר התקיימה כבר צרכה את
   החומר שלה, היא לא חלק מ"מה שעוד יידרש". */
function getUpcomingWorkshopParticipants() {
  return state.adminWorkshops
    .filter(w => daysBetween(TODAY, w.date) >= 0)
    .reduce((sum, w) => sum + w.participants, 0);
}

function getMaterialStatus(material) {
  const totalParticipants = getUpcomingWorkshopParticipants();
  const needed = +(totalParticipants * material.usagePerParticipant).toFixed(1);
  const remaining = +(material.stock - needed).toFixed(1);
  const margin = needed > 0 ? remaining / needed : 1;
  let level = 'ok';
  if (remaining < 0) level = 'short';
  else if (margin < 0.2) level = 'warning';
  return { needed, remaining, level };
}

const MATERIAL_STATUS_LABEL = {
  ok: { text: 'מספיק לסדנאות הקרובות', cls: 'tag-success' },
  warning: { text: 'קרוב לאזל', cls: 'tag-warning' },
  short: { text: 'לא יספיק — צריך להזמין', cls: 'tag-danger' },
};

function renderInventory() {
  const wrap = $('#admin-inventory-list');
  if (!wrap) return;
  $('#inventory-count').textContent = `· ${ADMIN_MATERIALS.length} חומרים`;

  const statuses = ADMIN_MATERIALS.map(m => ({ m, st: getMaterialStatus(m) }));
  const shortOnes = statuses.filter(({ st }) => st.level === 'short');
  const alertEl = $('#inventory-alert');
  if (alertEl) {
    alertEl.innerHTML = shortOnes.length
      ? `<div class="needs-attention-badge"><i class="ti ti-alert-triangle"></i> ${shortOnes.map(({ m }) => m.name).join(', ')} — לא צפוי/ים להספיק לסדנאות הקרובות</div>`
      : '';
  }

  wrap.innerHTML = statuses.map(({ m, st }) => {
    const label = MATERIAL_STATUS_LABEL[st.level];
    return `
    <div class="data-row">
      <span class="data-avatar"><i class="ti ti-flask"></i></span>
      <span class="data-row-body">
        <span class="data-row-title">${m.name}</span>
        <span class="data-row-sub">${m.stock} ${m.unit} במלאי · נדרש ${st.needed} ${m.unit} לסדנאות הקרובות</span>
      </span>
      <span class="tag ${label.cls}">${label.text}</span>
    </div>`;
  }).join('');

  renderInventoryHistory();
}

/* היסטוריית המלאי משלבת שני כיוונים: צריכה — נגזרת אוטומטית מסדנאות
   שכבר התקיימו (state.adminWorkshops בעבר × usagePerParticipant של
   החימר, שמשמש בכל סדנה ללא תלות בבחירת זיגוג) — והזמנות חוזרות
   שתמימה ביצעה בפועל (ADMIN_RESTOCKS, ראו data.js). שני הצדדים ביחד
   מסבירים למה המלאי הנוכחי נראה כמו שהוא, לא רק "מספר שהוקלד". */
function getInventoryHistory() {
  const clay = ADMIN_MATERIALS.find(m => m.name === 'חימר');
  const usageEvents = state.adminWorkshops
    .filter(w => daysBetween(TODAY, w.date) < 0)
    .map(w => ({
      date: w.date, materialId: clay.id,
      delta: -(+(w.participants * clay.usagePerParticipant).toFixed(1)),
      note: `סדנת ${w.name}`,
    }));
  const restockEvents = ADMIN_RESTOCKS.map(r => ({ date: r.date, materialId: r.materialId, delta: r.qty, note: r.note }));
  return [...usageEvents, ...restockEvents].sort((a, b) => b.date - a.date);
}

function renderInventoryHistory() {
  const wrap = $('#inventory-history-list');
  if (!wrap) return;
  const history = getInventoryHistory();
  wrap.innerHTML = history.map(h => {
    const material = ADMIN_MATERIALS.find(m => m.id === h.materialId);
    const isGain = h.delta > 0;
    return `
    <div class="data-row">
      <span class="data-avatar"><i class="ti ${isGain ? 'ti-arrow-up' : 'ti-arrow-down'}" style="color:${isGain ? 'var(--a-success-text, var(--c-success-text))' : 'var(--a-text-soft)'};"></i></span>
      <span class="data-row-body">
        <span class="data-row-title">${h.note}</span>
        <span class="data-row-sub">${fmtDate(h.date)} · ${material.name}</span>
      </span>
      <span class="data-row-meta ltr-nums" style="font-weight:600;color:${isGain ? 'var(--a-success-text, var(--c-success-text))' : 'var(--a-text)'};">${isGain ? '+' : ''}${h.delta} ${material.unit}</span>
    </div>`;
  }).join('');
}

/* -------------------------------------------------------------------------- */
/* ADMIN — Students / lessons management                                     */
/* -------------------------------------------------------------------------- */

function renderAdminStudents() {
  $('#admin-students-count').textContent = `${ADMIN_STUDENTS.length} סטודנטים · ${ADMIN_KPI.studioCapacityToday.total - ADMIN_KPI.studioCapacityToday.used} מתוך ${ADMIN_KPI.studioCapacityToday.total} מקום פנוי היום`;
  const wrap = $('#admin-students-list');
  const sorted = [...ADMIN_STUDENTS].sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
  wrap.innerHTML = sorted.map(s => `
    <div class="data-row ${s.urgent ? 'mobile-priority' : ''}">
      <span class="data-avatar">${s.name.split(' ').map(w => w[0]).join('')}</span>
      <span class="data-row-body">
        <span class="data-row-title">${s.name}</span>
        <span class="data-row-sub">${s.lessons} שיעורים · ${s.absences} היעדרויות</span>
      </span>
      <span class="tag ${s.urgent ? 'tag-warning' : 'tag-success'}">${s.status}</span>
    </div>`).join('');
}

/* -------------------------------------------------------------------------- */
/* ADMIN — Manual receipt                                                    */
/* -------------------------------------------------------------------------- */

function renderReceiptPicker() {
  const wrap = $('#receipt-picker-list');
  const needManual = state.adminWorkshops.filter(w => w.receipt === 'manual');
  if (needManual.length === 0) {
    wrap.innerHTML = `<div class="empty-hint"><i class="ti ti-circle-check"></i><p>אין קבלות ידניות ממתינות כרגע.</p></div>`;
    $('#receipt-calc').style.display = 'none';
    return;
  }
  wrap.innerHTML = needManual.map(w => `
    <button class="select-row ${state.adminSelectedReceipt === w.id ? 'is-selected' : ''}" data-receipt="${w.id}">
      <span class="select-row-icon"><i class="ti ti-users"></i></span>
      <span class="select-row-body">
        <span class="select-row-title">${w.name}</span>
        <span class="select-row-sub">${fmtDate(w.date)} · ${participantsLabel(w.participants)} · ${w.source}</span>
      </span>
    </button>`).join('');
  $all('[data-receipt]', wrap).forEach(el => el.addEventListener('click', () => {
    state.adminSelectedReceipt = Number(el.dataset.receipt);
    renderReceiptPicker();
    showReceiptCalc();
  }));
  if (state.adminSelectedReceipt) showReceiptCalc(); else $('#receipt-calc').style.display = 'none';
}

function showReceiptCalc() {
  const w = state.adminWorkshops.find(x => x.id === state.adminSelectedReceipt);
  if (!w) return;
  $('#receipt-calc').style.display = 'block';
  $('#calc-participants').textContent = participantsLabel(w.participants);
  $('#calc-total').textContent = `${workshopPrice(w.participants).toLocaleString('he-IL')} ₪`;
}

$('#receipt-generate-btn')?.addEventListener('click', () => {
  const w = state.adminWorkshops.find(x => x.id === state.adminSelectedReceipt);
  if (!w) return;
  const btn = $('#receipt-generate-btn');
  btn.classList.add('is-loading');
  setTimeout(() => {
    btn.classList.remove('is-loading');
    w.receipt = 'done';
    state.adminSelectedReceipt = null;
    $('#receipt-calc').style.display = 'none';
    renderReceiptPicker();
    showToast('admin', 'החשבונית והקבלה הופקו ונשלחו ללקוח', 'ti-check');
  }, 800);
});

