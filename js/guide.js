/* ==========================================================================
   מצב הדגמה מודרכת — טיפים שמצביעים על ההיגיון העסקי שמסתתר מתחת לממשק
   (נעילת משבצת, קבלה אוטומטית, נגזרות חיות של נתונים) ולא נראה במבט ראשון.

   שכבה תוספתית בלבד מעל app.js: עוטפת את window.onScreenEnter (בדיוק כמו
   motion-fx.js עוטף את openApp/backToHub) ומציגה טיפ קצר כשנכנסים למסך
   שיש לו אחד מוגדר, כל עוד המצב פעיל. ברירת מחדל: פעיל, כדי שהרושם
   הראשון יהיה חזק; אפשר לכבות/להדליק דרך הכפתור הצף.
   ========================================================================== */

(() => {
  const STORAGE_KEY = 'tamima-guide-on';
  const TIP_MS = 5200;
  const SHOW_DELAY = 480; // אחרי שהרינדור של המסך (כולל נתונים) כבר רץ

  function isOn() {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === '1';
  }
  function setOn(on) {
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch (e) {}
  }

  const TIPS = {
    'client:c2': { sel: '#summary-price', text: 'המחיר מתעדכן בזמן אמת ממחירון הקבוצה האמיתי של הסטודיו — לא מחיר-לאיש קווי.' },
    'client:c3': { sel: '#pay-btn', text: 'ברגע שמגיעים לכאן המשבצת נעולה לכם ל-3 דקות מאחורי הקלעים, כדי שלקוח/ה אחר/ת לא יתפוס/תתפוס אותה באמצע.' },
    'client:c5': { sel: '#wa-customer-body', text: 'חשבונית + קבלה נשלחות אוטומטית בוואטסאפ, באותו רגע — בלי שתמימה תזיז אצבע.' },
    'admin:a-dashboard': { sel: '#admin-pending-list, #admin-pending-list-m', text: 'הרשימה הזו נגזרת חיה מהתלמידות שבאמת ממתינות — אף אחת לא "נופלת בין הכיסאות".' },
    'admin:a-workshops': { sel: '.tag-warning', text: 'תג "דורש קבלה ידנית" מסמן אילו סדנאות (למשל מבסלון) לא הופקו אוטומטית.' },
    'admin:a-inventory': { sel: '#admin-inventory-list', text: 'הצפי מחושב חי לפי המשתתפים בסדנאות הקרובות — לא הערכה ידנית, אז ההתראה מגיעה לפני שהחומר נגמר בפועל.' },
    'student:s1': { sel: '#student-pkg-card', text: 'ההתקדמות מתעדכנת לפי נוכחות בפועל בסטודיו — לא לפי תאריך ההרשמה.' },
  };

  let tipEl = null, ringEl = null, hideTimer = null;

  function firstVisible(selector) {
    for (const sel of selector.split(',')) {
      const els = document.querySelectorAll(sel.trim());
      for (const el of els) {
        if (el.offsetParent !== null) return el;
      }
    }
    return null;
  }

  function hideTip() {
    clearTimeout(hideTimer);
    if (tipEl) { tipEl.remove(); tipEl = null; }
    if (ringEl) { ringEl.remove(); ringEl = null; }
    document.removeEventListener('scroll', hideTip, true);
  }

  function showTip(target, text) {
    hideTip();
    const r = target.getBoundingClientRect();

    ringEl = document.createElement('div');
    ringEl.className = 'guide-ring';
    ringEl.style.top = r.top + 'px';
    ringEl.style.left = r.left + 'px';
    ringEl.style.width = r.width + 'px';
    ringEl.style.height = r.height + 'px';
    document.body.appendChild(ringEl);

    tipEl = document.createElement('div');
    tipEl.className = 'guide-tip';
    tipEl.innerHTML =
      '<span class="guide-tip-icon"><i class="ti ti-bulb"></i></span>' +
      '<span class="guide-tip-text"></span>' +
      '<button class="guide-tip-close" type="button" aria-label="סגירה"><i class="ti ti-x"></i></button>';
    tipEl.querySelector('.guide-tip-text').textContent = text;
    document.body.appendChild(tipEl);

    const tipRect = tipEl.getBoundingClientRect();
    let top = r.bottom + 12;
    let placeAbove = false;
    if (top + tipRect.height > innerHeight - 16) { top = r.top - tipRect.height - 12; placeAbove = true; }
    top = Math.max(12, top);
    let left = r.left + r.width / 2 - tipRect.width / 2;
    left = Math.max(12, Math.min(left, innerWidth - tipRect.width - 12));
    tipEl.style.top = top + 'px';
    tipEl.style.left = left + 'px';
    tipEl.classList.add(placeAbove ? 'is-above' : 'is-below');
    requestAnimationFrame(() => { if (tipEl) tipEl.classList.add('is-visible'); });

    tipEl.querySelector('.guide-tip-close').addEventListener('click', hideTip);
    document.addEventListener('scroll', hideTip, true);
    hideTimer = setTimeout(hideTip, TIP_MS);
  }

  function maybeShow(appId, screenId) {
    if (!isOn()) return;
    const tip = TIPS[`${appId}:${screenId}`];
    if (!tip) return;
    setTimeout(() => {
      const target = firstVisible(tip.sel);
      if (target) showTip(target, tip.text);
    }, SHOW_DELAY);
  }

  if (typeof window.onScreenEnter === 'function') {
    const baseOnScreenEnter = window.onScreenEnter;
    window.onScreenEnter = function (appId, screenId) {
      hideTip();
      baseOnScreenEnter(appId, screenId);
      maybeShow(appId, screenId);
    };
  }

  document.addEventListener('click', e => {
    if (tipEl && !e.target.closest('.guide-tip') && !e.target.closest('.guide-toggle')) hideTip();
  });

  const toggle = document.getElementById('guide-toggle');
  if (toggle) {
    const sync = () => toggle.classList.toggle('is-on', isOn());
    sync();
    toggle.addEventListener('click', () => {
      setOn(!isOn());
      sync();
      hideTip();
    });
  }
})();
