/* ==========================================================================
   Motion FX — שכבת שיפור פרוגרסיבי מעל האנימציות ב-CSS, באמצעות Motion.dev
   (הספרייה היורשת של Framer Motion, בגרסת ה-JS הווניל שלה — בלי React,
   בלי build step, טעינה ישירה מ-CDN).

   עיקרון: הכל כאן הוא תוספת. אם הרשת לא זמינה, אם prefers-reduced-motion
   פעיל, או אם טעינת הספרייה נכשלת — האתר ממשיך לעבוד בדיוק כמו קודם עם
   האנימציות ב-CSS. שום דבר לא *תלוי* בקובץ הזה.

   נטען אחרון (אחרי app.js) ומשפר במקום:
   1. מעברי מסך — spring אמיתי במקום CSS keyframes קבועים
   2. ריחוף שכבות הרקע — spring loop אמיתי במקום ease-in-out ליניארי
   3. סימן ✓ בהצלחה — ציור SVG אמיתי (stroke draw-on) במקום גופן אייקון
   4. משוב לחיצה — spring אחיד על כל משטח לחיץ באתר
   5. מעבר בין 3 האפליקציות (וחזרה ל-Hub) — fade+scale אמיתי במקום קפיצה
   6. גרירה-לסגירה על ה-bottom sheet של המשבצת החלופית
   7. ספירת מספרים ב-spring אמיתי (KPI) במקום ה-easeOutCubic הידני
   8. רגע מעבר עדין כשמחליפים יום בבורר התאריך
   ========================================================================== */

(async () => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let animate, stagger;
  try {
    ({ animate, stagger } = await import('https://cdn.jsdelivr.net/npm/motion@13.4.0/+esm'));
  } catch (e) {
    return; // הרשת לא זמינה / חסימה — נופלים בחזרה ל-CSS הקיים, בלי שגיאה
  }

  const SPRING = { type: 'spring', stiffness: 260, damping: 26, mass: 0.9 };
  const SPRING_PRESS = { type: 'spring', stiffness: 520, damping: 32 };
  const EASE = [0.22, 1, 0.36, 1];

  /* בקרת ריחוף לפי-במה — ראו סעיף 2. מוגדר כאן כדי שסעיף 5 (מעברים) יוכל
     לקרוא ל-setActiveDriftScope בלי תלות בסדר ההגדרה. */
  const driftGroups = new Map(); // scopeEl -> controls[]
  let activeDriftScope = null;
  function setActiveDriftScope(scopeEl) {
    if (!scopeEl || activeDriftScope === scopeEl) return;
    driftGroups.get(activeDriftScope)?.forEach(c => c.pause());
    activeDriftScope = scopeEl;
    driftGroups.get(scopeEl)?.forEach(c => c.play());
  }

  /* לעולם לא לתלות פעולת ניווט/מצב אמיתית בסיום אנימציה בלבד — אם ההבטחה
     לא מתיישבת (מכשיר איטי, אנימציה שנקטעת, טאב לא פעיל) הממשק לא יתקע. */
  function settleWithin(promiseLike, ms) {
    return Promise.race([
      Promise.resolve(promiseLike).catch(() => {}),
      new Promise(resolve => setTimeout(resolve, ms)),
    ]);
  }

  /* -------------------------------------------------------------------- */
  /* 1. מעברי מסך — רק בזרימות הנייד הליניאריות (לקוח/סטודנט).            */
  /*    צד הניהול משתמש בדפוס fade-בלבד משלו ונשאר כמו שהוא.              */
  /* -------------------------------------------------------------------- */
  if (typeof window.goToScreen === 'function') {
    const baseGoToScreen = window.goToScreen;
    window.goToScreen = function (appId, screenId, dir = 'forward', isReset = false) {
      baseGoToScreen(appId, screenId, dir, isReset);
      if (appId !== 'client' && appId !== 'student') return;

      const root = document.getElementById('app-' + appId);
      const active = root && root.querySelector('.screen.is-active');
      if (!active) return;

      // ה-CSS כבר הוסיף enter-forward/enter-back; מנטרלים כדי שה-spring
      // ישתלט בלי "התכתשות" על אותה תכונת transform.
      active.classList.remove('enter-forward', 'enter-back');
      const fromX = dir === 'back' ? 28 : -28;
      animate(active,
        { opacity: [0, 1], x: [fromX, 0] },
        { duration: 0.5, ease: EASE }
      );

      drawSuccessIcon(active);
      popStepDot(active);
    };
  }

  /* נקודת ההתקדמות הפעילה "נוחתת" עם קפיצת spring קלה במקום להופיע קפואה —
     ה-CSS כבר מרחיב אותה (transition על width), זה רק מוסיף טעם. */
  function popStepDot(scope) {
    const dot = scope.querySelector('.step-dots .active');
    if (!dot) return;
    animate(dot, { scale: [0.4, 1] }, { type: 'spring', stiffness: 420, damping: 18, delay: 0.1 });
  }

  /* -------------------------------------------------------------------- */
  /* 2. ריחוף שכבות הרקע — spring loop אמיתי במקום ה-CSS keyframes.        */
  /*    כל במה (Hub + 3 אפליקציות) מכילה 8 שכבות דוהות-אינסוף; בלי בקרה   */
  /*    זה 32 אנימציות רצות בו-זמנית תמיד, גם בבמות שמוסתרות לגמרי —      */
  /*    בזבוז CPU מתמשך שמרגיש כ"לאגיות" במיוחד במכשירים חלשים. רק הבמה   */
  /*    הפעילה כרגע רצה; היתר מושהות ב-.pause() עד שמנווטים אליהן.        */
  /* -------------------------------------------------------------------- */
  document.querySelectorAll('.strata-drift').forEach(el => {
    const cs = getComputedStyle(el);
    const dx = parseFloat(cs.getPropertyValue('--dx')) || 0;
    const dy = parseFloat(cs.getPropertyValue('--dy')) || 0;
    const dur = parseFloat(cs.getPropertyValue('--dur')) || 30;
    el.style.animation = 'none'; // מוסר את ה-CSS, ה-JS לוקח את ההגה מכאן
    const controls = animate(el,
      { x: [0, dx, 0], y: [0, dy, 0] },
      { duration: dur, repeat: Infinity, ease: 'easeInOut' }
    );
    const scopeEl = el.closest('.hub, .app-wrap');
    if (!scopeEl) return;
    if (!driftGroups.has(scopeEl)) driftGroups.set(scopeEl, []);
    driftGroups.get(scopeEl).push(controls);
  });
  driftGroups.forEach((controls, scopeEl) => {
    if (scopeEl.id === 'hub') { activeDriftScope = scopeEl; return; } // הבמה הגלויה בטעינה
    controls.forEach(c => c.pause());
  });

  /* -------------------------------------------------------------------- */
  /* 3. סימן הצלחה — ציור SVG אמיתי (stroke-dashoffset) בכל פעם שמגיעים   */
  /*    למסך עם .success-check-path                                       */
  /* -------------------------------------------------------------------- */
  function drawSuccessIcon(scope) {
    const circle = scope.querySelector('.success-icon');
    if (!circle) return;
    circle.querySelector('.success-ring')?.remove(); // ביקור חוזר במסך — לא מצטבר

    animate(circle, { scale: [0.7, 1], opacity: [0, 1] }, SPRING);

    const path = circle.querySelector('.success-check-path');
    if (path) {
      const len = path.getTotalLength();
      path.style.strokeDasharray = String(len);
      path.style.strokeDashoffset = String(len);
      animate(path, { strokeDashoffset: [len, 0] }, { duration: 0.5, ease: EASE, delay: 0.18 });
    }

    // בלוק אור שנפתח כלפי חוץ ברגע שהסימן "נוחת" — עובד גם עבור אייקון-גופן
    // (למשל שיעור השלמה) וגם עבור ה-checkmark המצויר.
    const ring = document.createElement('span');
    ring.className = 'success-ring';
    circle.appendChild(ring);
    settleWithin(
      animate(ring, { scale: [1, 1.9], opacity: [0.55, 0] }, { duration: 0.7, ease: EASE, delay: 0.32 }).finished,
      1200
    ).then(() => ring.remove());
  }
  // מסך הצלחה ראשון (c4) עשוי להיות פעיל כבר בטעינה בהדגמות ידניות — נסרוק פעם אחת
  document.querySelectorAll('.screen.is-active').forEach(drawSuccessIcon);

  /* -------------------------------------------------------------------- */
  /* 4. משוב לחיצה אחיד — spring במקום קפיצת scale מיידית של ה-CSS        */
  /* -------------------------------------------------------------------- */
  const PRESSABLE = '.btn, .select-row, .chip, .hub-row, .stepper-btn, ' +
    '.icon-btn, .bottom-nav .nav-btn, .admin-bottom-nav .nav-btn, ' +
    '.admin-nav-item, .exit-btn, .view-toggle';

  document.addEventListener('pointerdown', e => {
    const t = e.target.closest(PRESSABLE);
    if (t) animate(t, { scale: 0.965 }, SPRING_PRESS);
  });
  const release = e => {
    const t = e.target.closest(PRESSABLE);
    if (t) animate(t, { scale: 1 }, SPRING);
  };
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);

  /* -------------------------------------------------------------------- */
  /* 5. מעבר בין Hub לבין 3 האפליקציות — fade+scale אמיתי, לא קפיצה       */
  /* -------------------------------------------------------------------- */
  if (typeof window.openApp === 'function' && typeof window.backToHub === 'function') {
    const baseOpenApp = window.openApp;
    const baseBackToHub = window.backToHub;

    /* טוקן-ביטול: אם נלחץ ניווט נוסף לפני שהמעבר הקודם השלים, השלמה
       "מיושנת" שמגיעה באיחור לא תדרוס מצב שכבר החליף אותה (ראו
       cancellable-state-transitions — בלי זה, לחיצה מהירה כפולה שוברת
       את הניווט). */
    let transitionToken = 0;

    /* origin: נקודת המסך שבה הלקוח לחץ, כדי שהאפליקציה תיפתח "מתוך" האצבע
       (portal-zoom) במקום להבליח סימטרית מהמרכז — זה מה שנותן לכניסה
       תחושה של עומק ולא רק fade רגיל. */
    function crossFade(outEl, showFn, origin) {
      const myToken = ++transitionToken;
      const finish = () => {
        if (myToken !== transitionToken) return; // מעבר חדש יותר כבר קרה — מתעלמים
        showFn();
        const inEl = document.querySelector('.app-wrap.active') ||
          (document.getElementById('hub').style.display !== 'none' ? document.getElementById('hub') : null);
        if (!inEl) return;
        setActiveDriftScope(inEl);
        if (origin) {
          const r = inEl.getBoundingClientRect();
          const ox = ((origin.x - r.left) / r.width) * 100;
          const oy = ((origin.y - r.top) / r.height) * 100;
          inEl.style.transformOrigin = `${ox}% ${oy}%`;
          animate(inEl, { opacity: [0, 1], scale: [0.55, 1] }, { duration: 0.52, ease: EASE })
            .finished.then(() => { inEl.style.transformOrigin = ''; }).catch(() => {});
        } else {
          animate(inEl, { opacity: [0, 1], scale: [0.985, 1] }, { duration: 0.42, ease: EASE });
        }
      };
      if (outEl) {
        const anim = animate(outEl, { opacity: [1, 0], scale: [1, 0.985] }, { duration: 0.26, ease: EASE });
        settleWithin(anim.finished, 350).then(finish);
      } else {
        finish();
      }
    }

    window.openApp = function (appId) {
      const hub = document.getElementById('hub');
      const hubVisible = hub && hub.style.display !== 'none';
      const origin = hubVisible ? window.__lastOpenOrigin : null;
      crossFade(hubVisible ? hub : null, () => baseOpenApp(appId), origin);
      window.__lastOpenOrigin = null;
    };
    window.backToHub = function () {
      const active = document.querySelector('.app-wrap.active');
      crossFade(active, () => baseBackToHub());
    };
  }

  /* -------------------------------------------------------------------- */
  /* 6. גרירה-לסגירה על ידית ה-bottom sheet (בורר משבצת חלופית)           */
  /* -------------------------------------------------------------------- */
  const sheet = document.getElementById('slot-picker-overlay')?.querySelector('.sheet');
  const handle = sheet?.querySelector('.sheet-handle');
  const overlay = document.getElementById('slot-picker-overlay');
  if (sheet && handle && overlay) {
    let startY = 0, dragY = 0, dragging = false;
    const DISMISS_AT = 90;

    handle.style.touchAction = 'none';
    handle.addEventListener('pointerdown', e => {
      dragging = true;
      startY = e.clientY;
      handle.setPointerCapture?.(e.pointerId);
    });
    handle.addEventListener('pointermove', e => {
      if (!dragging) return;
      dragY = Math.max(0, e.clientY - startY);
      sheet.style.transform = `translateY(${dragY}px)`;
      overlay.style.opacity = String(1 - Math.min(dragY / 300, 0.6));
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      overlay.style.opacity = '';
      if (dragY > DISMISS_AT && typeof window.closeSlotPicker === 'function') {
        animate(sheet, { y: [dragY, 400] }, { duration: 0.22, ease: EASE });
        const fade = animate(overlay, { opacity: [1 - Math.min(dragY / 300, 0.6), 0] }, { duration: 0.22 });
        settleWithin(fade.finished, 300).then(() => { window.closeSlotPicker(); sheet.style.transform = ''; });
      } else {
        const back = animate(sheet, { y: [dragY, 0] }, SPRING);
        settleWithin(back.finished, 400).then(() => { sheet.style.transform = ''; });
      }
      dragY = 0;
    };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  }

  /* -------------------------------------------------------------------- */
  /* 7. ספירת מספרים ב-spring אמיתי (KPI) — מחליף easeOutCubic ידני       */
  /* -------------------------------------------------------------------- */
  if (typeof window.countUp === 'function') {
    window.countUp = function (el, target, opts = {}) {
      const prefix = opts.prefix || '';
      const suffix = opts.suffix || '';
      animate(0, target, {
        type: 'spring', stiffness: 90, damping: 22, mass: 1,
        onUpdate: latest => {
          el.textContent = prefix + Math.round(latest).toLocaleString('he-IL') + suffix;
        },
      });
    };
  }

  /* -------------------------------------------------------------------- */
  /* 8. רגע מעבר עדין כשמחליפים יום בבורר התאריך                          */
  /* -------------------------------------------------------------------- */
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-day]')) return;
    requestAnimationFrame(() => {
      const wrap = document.getElementById('slots-wrap');
      if (wrap) animate(wrap, { opacity: [0, 1], y: [10, 0] }, { duration: 0.32, ease: EASE });
    });
  });
})();
