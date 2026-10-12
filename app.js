(() => {
  'use strict';
  const DIM = { p: [1440, 1920], l: [1920, 1440], m: [414, 899] };
  const canv = {};
  document.querySelectorAll('.canvas').forEach(c => { canv[c.dataset.cv] = c; });

  // ---------- global state (shared by all canvases, survives rotation) ----------
  // rs: result sub-state  C = no concern selected, W = wrinkles selected (sub rows unfolded)
  const NSTEP = 7;
  const init = () => ({ screen: 'result', rs: 'C', shelf: true, mode: 'analysis', dd: false, rec: 'products', filter: 'all',
    det: 0, fm: false, done: Array(NSTEP).fill(false) });
  let S = init();
  let cur = null;

  const screenKey = () => {
    if (S.screen !== 'rec') return S.screen;
    if (S.rec === 'products') return S.filter === 'redness' ? 'recRed' : 'recAll';
    return S.rec;
  };
  const photoKey = () => {
    if (S.mode === 'original') return 'orig';
    if (S.mode === 'focus') return 'fwr';
    return S.rs === 'W' ? 'wr' : 'all';
  };

  // ---------- layout / orientation ----------
  function pickCv() {
    const w = window.innerWidth, h = window.innerHeight;
    if (w < 600) return 'm';
    return w > h ? 'l' : 'p';
  }
  function layout() {
    const cv = pickCv();
    if (cv !== cur) {
      if (cur) canv[cur].classList.remove('active');
      cur = cv; canv[cv].classList.add('active');
    }
    const [W, H] = DIM[cv];
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.min(vw / W, vh / H);
    const c = canv[cv];
    c._s = s;
    c.style.transform = `translate(${(vw - W * s) / 2}px, ${(vh - H * s) / 2}px) scale(${s})`;
    syncLive(c);
    updateHint();
  }

  // measurements that only work on the visible canvas
  function syncLive(c) {
    c.querySelectorAll('.wr-sub').forEach(w => { w.style.height = S.rs === 'W' ? w.scrollHeight + 'px' : '0px'; });
    syncDet(c);
  }

  // concern detail: tab pager
  function syncDet(c, animate) {
    const sc = c.querySelector('.screen[data-screen="detail"]'); if (!sc) return;
    const track = sc.querySelector('.det-track'), pager = sc.querySelector('.det-pager');
    const panels = [...sc.querySelectorAll('.det-panel')];
    panels.forEach((p, i) => p.classList.toggle('dp-on', i === S.det));
    if (track) track.style.transform = `translateX(${-S.det * DIM[c.dataset.cv][0]}px)`;
    const p = panels[S.det];
    if (pager && p && p.offsetHeight) pager.style.height = p.offsetHeight + 'px';
    sc.querySelectorAll('.dtab').forEach((t, i) => t.classList.toggle('dt-on', i === S.det));
    const on = sc.querySelector('.dtab.dt-on'), ul = sc.querySelector('.det-ul');
    if (on && ul && ul.offsetParent && on.offsetWidth) {
      const s = c._s || 1, a = on.getBoundingClientRect(), b = ul.offsetParent.getBoundingClientRect();
      ul.style.left = ((a.left - b.left) / s) + 'px';
      ul.style.width = (a.width / s) + 'px';
    }
    const ov = sc.querySelector('.det-ov'); if (ov) ov.classList.toggle('fm-on', S.fm);
    sc.querySelectorAll('.vt-opt').forEach(o => o.classList.toggle('vt-on', (o.dataset.name === 'opt_Focus') === S.fm));
  }

  // ---------- render state into every canvas ----------
  function apply(resetScroll) {
    const key = screenKey();
    if (S.mode === 'focus' && S.rs !== 'W') S.mode = 'analysis';
    for (const cv in canv) {
      const c = canv[cv];
      c.classList.toggle('f-red', S.filter === 'redness');
      c.querySelectorAll(':scope > .screen').forEach(sc => {
        const on = sc.dataset.screen === key;
        sc.classList.toggle('active', on);
        if (on && resetScroll) { const sr = sc.querySelector('.scroller'); if (sr) sr.scrollTop = 0; }
      });
      const rf = c.querySelector('.result-frame');
      if (rf) {
        ['C', 'W'].forEach(s => rf.classList.toggle('s-' + s, S.rs === s));
        ['analysis', 'focus', 'original'].forEach(m => rf.classList.toggle('m-' + m, S.mode === m));
        rf.classList.toggle('shelf-open', S.shelf);
        rf.querySelectorAll('.shelf').forEach(g => g.classList.toggle('cur', g.classList.contains(S.shelf ? 'shelf-o' : 'shelf-c')));
        rf.classList.toggle('dd-open', S.dd);
        const pk = photoKey();
        rf.querySelectorAll('.ph').forEach(im => im.classList.toggle('on', im.classList.contains('ph-' + pk)));
        rf.classList.toggle('no-focus', S.rs !== 'W');
        rf.querySelectorAll('.dd-row').forEach(row => {
          const sel = row.dataset.mode === S.mode;
          row.classList.toggle('sel', sel);
          const dot = row.querySelector('img');
          if (dot) dot.src = sel ? 'assets/56d90.svg' : 'assets/2df40.svg';
        });
      }
      if (cv === cur) syncLive(c); else c.querySelectorAll('.wr-sub').forEach(w => { if (S.rs !== 'W') w.style.height = '0px'; });
    }
    requestAnimationFrame(() => { if (cur) syncDet(canv[cur]); updateHint(); });
    setTimeout(() => { if (cur) syncDet(canv[cur]); updateHint(); }, 480);
  }
  // after the wrinkle rows unfold, keep them in view
  function revealWrinkles() {
    setTimeout(() => {
      const c = canv[cur], list = c.querySelector('.clist'), row = c.querySelector('.wr-row');
      if (!list || !row) return;
      const s = c._s || 1, lr = list.getBoundingClientRect(), rr = row.getBoundingClientRect();
      smoothTo(list, Math.max(0, list.scrollTop + (rr.top - lr.top) / s - 10));
    }, 80);
  }

  // ---------- navigation ----------
  function go(screen, opts = {}) {
    S.screen = screen;
    if (opts.rec) S.rec = opts.rec;
    if (opts.filter) S.filter = opts.filter;
    if (screen === 'detail') { S.det = 0; S.fm = false; }
    S.dd = false;
    apply(true);
  }
  const advance = n => { S.done[n] = true; };

  // ---------- take photo + analysis ----------
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  function stopTake() {
    timers.forEach(clearTimeout); timers = [];
    document.querySelectorAll('.take').forEach(t => {
      t.classList.remove('analyzing');
      t.querySelectorAll('.scan, .scan-done').forEach(x => { x.classList.remove('on'); if (x.tagName === 'IMG') x.removeAttribute('src'); });
      const c = t.querySelector('.tp-count'); c.textContent = ''; c.classList.remove('tick');
    });
  }
  const each = (sel, fn) => document.querySelectorAll('.take ' + sel).forEach(fn);
  function play(sel, file) { const v = Date.now(); each(sel, im => { im.src = 'assets/' + file + '?v=' + v; im.classList.add('on'); }); }
  function hide(sel) { each(sel, im => im.classList.remove('on')); }
  function startTake() {
    stopTake();
    S.dd = false; S.screen = 'take'; apply(true);
    [3, 2, 1].forEach((n, i) => later(300 + i * 1000, () => each('.tp-count', c => { c.textContent = n; c.classList.remove('tick'); void c.offsetWidth; c.classList.add('tick'); })));
    later(3300, () => {
      each('.tp-count', c => { c.textContent = ''; });
      each('.tp-flash', f => { f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); });
      document.querySelectorAll('.take').forEach(t => t.classList.add('analyzing'));
      play('.scan-rings', 'scan_rings.png');
    });
    later(3300 + 1950, () => { hide('.scan-rings'); play('.scan-dots', 'scan_dots.png'); });
    later(3300 + 1950 + 1850, () => { hide('.scan-dots'); play('.scan-check', 'scan_check.png'); each('.scan-done', d => d.classList.add('on')); });
    // check mark plays once and holds its last frame, then straight on to the result
    later(3300 + 1950 + 1850 + 1350, () => { stopTake(); S = init(); apply(true); resetLists(); });
  }
  function resetLists() { document.querySelectorAll('.clist').forEach(l => { l.scrollTop = 0; }); }

  // ---------- interactions ----------
  const isBack = n => /^btn_skincarepro_back/.test(n) || /^btn_ymk_livecam_back/.test(n);
  const isHome = n => /^btn_(y4b_skincarecm_home|skincarepro_home)/.test(n);
  const isGlasses = n => /^btn_skincarepro_(compare_s|previewmodes)/.test(n);

  function handle(name, el) {
    if (name === 'btn_take_back') { stopTake(); S.screen = 'result'; apply(true); return true; }
    if (S.screen === 'take') return true;
    if (S.screen === 'result' && (isBack(name) || isHome(name))) return true;   // disabled on the result page
    if (isBack(name)) {
      // Report / concern detail / Recommendation go back to the analysis result; elsewhere back restarts from the photo
      if (/^(report|detail|rec)$/.test(S.screen)) { S.screen = 'result'; S.dd = false; apply(true); }
      else startTake();
      return true;
    }
    if (isHome(name)) { startTake(); return true; }
    if (S.screen === 'result') {
      if (el.classList && el.classList.contains('dd-row')) {
        if (el.dataset.mode === 'focus' && S.rs !== 'W') return true;   // focus needs a selected concern
        S.mode = el.dataset.mode; advance(1); modeAt = Date.now(); apply(); setTimeout(updateHint, 3050); return true;   // dropdown stays open
      }
      if (isGlasses(name)) { S.dd = !S.dd; apply(); return true; }
      if (name === 'handelr') { S.shelf = !S.shelf; apply(); return true; }
      if (name === 'row_Wrinkles' || name === 'badge_plus' || name === 'badge_minus') {
        if (el.closest('.wr-row')) {
          if (S.rs === 'C') { S.rs = 'W'; advance(0); apply(); revealWrinkles(); }
          else { S.rs = 'C'; apply(); }
          return true;
        }
      }
      if (name === 'btn_view_report') { advance(2); go('report'); return true; }
      if (name === 'btn_retake') { startTake(); return true; }
      if (/^tab_(Products|Routines|Treatments)/.test(name)) return true;
      return false;
    }
    if (name === 'concern_card_Redness') { advance(3); go('detail'); return true; }
    if (name === 'btn_matching_products') { advance(4); go('rec', { rec: 'products', filter: 'redness' }); return true; }
    if (name === 'tab_Report') { if (S.screen !== 'report') go('report'); return true; }
    if (name === 'tab_Recommendation') { go('rec', { rec: 'products', filter: 'all' }); return true; }
    if (name === 'tab_Get Report') { advance(5); if (S.screen !== 'share') go('share'); return true; }
    if (S.screen === 'detail') {
      const m = /^dtab_(\d)$/.exec(name);
      if (m) { setDet(+m[1]); return true; }
      if (name === 'opt_Analysis') { S.fm = false; syncDet(canv[cur]); return true; }
      if (name === 'opt_Focus') { S.fm = true; syncDet(canv[cur]); return true; }
    }
    if (S.screen === 'rec') {
      if (/^tab_Products/.test(name)) { S.rec = 'products'; apply(true); return true; }
      if (/^tab_Routines/.test(name)) { S.rec = 'routines'; apply(true); return true; }
      if (/^tab_Treatments/.test(name)) { S.rec = 'treatments'; apply(true); return true; }
      if (/^chip_All/.test(name)) { if (S.filter !== 'all') { S.filter = 'all'; apply(S.rec === 'products'); } return true; }
      if (/^chip_Redness/.test(name)) { if (S.filter !== 'redness') { S.filter = 'redness'; apply(S.rec === 'products'); } return true; }
    }
    return false;
  }
  function setDet(i) {
    i = Math.max(0, Math.min(2, i));
    if (i === S.det) { syncDet(canv[cur]); return; }
    S.det = i; syncDet(canv[cur]);
    setTimeout(updateHint, 480);
  }

  let swallowClick = false;
  document.getElementById('stage').addEventListener('click', e => {
    if (swallowClick) { swallowClick = false; return; }
    let n = e.target;
    const insideDd = n.closest && (n.closest('.dd') || n.closest('[data-name^="btn_skincarepro_compare_s"],[data-name^="btn_skincarepro_previewmodes"]'));
    if (S.dd && !insideDd) { S.dd = false; apply(); return; }   // tap outside closes the dropdown
    while (n && n.id !== 'stage') {
      const name = n.getAttribute && n.getAttribute('data-name');
      if ((name || (n.classList && n.classList.contains('dd-row'))) && handle(name || '', n)) return;
      n = n.parentElement;
    }
  });

  // swipe between the concern-detail tabs
  let drag = null;
  document.addEventListener('pointerdown', e => {
    const pager = e.target.closest && e.target.closest('.det-pager');
    if (!pager || S.screen !== 'detail') return;
    drag = { x: e.clientX, y: e.clientY, pager, track: pager.querySelector('.det-track'), on: false, id: e.pointerId };
  });
  document.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) { drag.on = true; drag.track.classList.add('drag'); }
      else if (Math.abs(dy) > 10) { drag = null; return; }
      else return;
    }
    const c = canv[cur], s = c._s || 1, W = DIM[cur][0];
    let off = dx / s;
    if ((S.det === 0 && off > 0) || (S.det === 2 && off < 0)) off *= 0.3;
    drag.track.style.transform = `translateX(${-S.det * W + off}px)`;
  });
  const endDrag = e => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag; drag = null;
    if (!d.on) return;
    d.track.classList.remove('drag');
    swallowClick = true; setTimeout(() => { swallowClick = false; }, 60);
    const s = canv[cur]._s || 1, dx = ((e ? e.clientX : d.x) - d.x) / s, W = DIM[cur][0];
    if (dx < -W * 0.15) setDet(S.det + 1);
    else if (dx > W * 0.15) setDet(S.det - 1);
    else syncDet(canv[cur]);
  };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', () => { if (drag) { const d = drag; drag = null; d.track.classList.remove('drag'); syncDet(canv[cur]); } });

  // ---------- guided hints ----------
  const visible = el => {
    if (!el || el.closest('.shelf:not(.cur), .wr-row > :not(.wr-x):not(.wr-w), .det-panel:not(.dp-on)')) return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  };
  const firstVis = (root, sel) => [...root.querySelectorAll(sel)].find(visible) || null;
  const STEP_SCREEN = [/^result$/, /^result$/, /^result$/, /^report$/, /^detail$/, /^(recAll|recRed|routines|treatments)$/, /^share$/];
  function stepTarget(i, sc) {
    switch (i) {
      case 0: return S.rs === 'C' ? firstVis(sc, '.wr-x > :first-child') : null;
      case 1: return S.dd ? firstVis(sc, '.dd-row:not(.sel):not([data-mode="focus"]), .result-frame.s-W .dd-row[data-mode="focus"]:not(.sel)') : firstVis(sc, '[data-name^="btn_skincarepro_compare_s"], [data-name^="btn_skincarepro_previewmodes"]');
      case 2: return (Date.now() - modeAt >= 3000) ? firstVis(sc, '[data-name="btn_view_report"]') : null;
      case 3: return firstVis(sc, '[data-name="concern_card_Redness"]');
      case 4: return firstVis(sc, '.dp-on [data-name="btn_matching_products"]');
      case 5: return firstVis(sc, '.fixedlayer [data-name="tab_Get Report"]');
      case 6: return firstVis(sc, '.fixedlayer [data-name^="btn_skincarepro_back"]');
    }
  }
  // each page points at its own next step, whatever was skipped elsewhere
  function hintTarget(c) {
    const sc = c.querySelector(':scope > .screen.active');
    if (!sc) return null;
    const scr = sc.dataset.screen;
    for (let i = 0; i < NSTEP; i++) {
      if (S.done[i] || !STEP_SCREEN[i].test(scr)) continue;
      const t = stepTarget(i, sc);
      if (t) { hintStep = i; return t; }
    }
    return null;
  }
  let hintStep = -1, modeAt = 0;

  // bring an off-screen hint target into view: lists right away; pages are left for the user to scroll
  let revealTag = '', autoScrollUntil = 0;
  function smoothTo(box, top) {
    autoScrollUntil = Date.now() + 900;
    if ('scrollBehavior' in document.documentElement.style) box.scrollTo({ top, behavior: 'smooth' });
    else box.scrollTop = top;
  }
  function scheduleReveal(t, c) {
    const tag = hintStep + ':' + S.screen + ':' + S.rs + ':' + cur;
    if (revealTag === tag) return;
    revealTag = tag;
    const s = c._s || 1;
    const list = t.closest('.list-scroll');
    if (list) {
      const br = list.getBoundingClientRect(), r = t.getBoundingClientRect();
      if (r.top < br.top || r.bottom > br.bottom - br.height * 0.12) smoothTo(list, list.scrollTop + (r.top - br.top - br.height * 0.3) / s);
    }
  }

  let scrolling = false, scrollTimer = null;
  function updateHint() {
    if (!cur) return;
    for (const cv in canv) if (cv !== cur) { const l = canv[cv].querySelector('.hint-layer'); if (l) l.classList.remove('hint-on'); }
    const c = canv[cur], layer = c.querySelector('.hint-layer'), dot = layer.querySelector('.hint');
    const t = hintTarget(c);
    if (t) scheduleReveal(t, c);
    if (!t || scrolling) { layer.classList.remove('hint-on'); return; }
    const s = c._s || 1, cr = c.getBoundingClientRect(), r = t.getBoundingClientRect();
    const x = (r.left - cr.left + r.width / 2) / s, y = (r.top - cr.top + r.height / 2) / s;
    if (y < 0 || y > DIM[cur][1]) { layer.classList.remove('hint-on'); return; }
    const sc = t.closest('.screen'), fl = sc && sc.querySelector(':scope > .fixedlayer');
    const home = (fl && !t.closest('.fixedlayer')) ? sc : c;     // inside the page: below the fixed bars
    if (layer.parentElement !== home) { if (home === sc) sc.insertBefore(layer, fl); else c.appendChild(layer); }
    const tag = hintStep + ':' + S.screen + ':' + S.dd;
    if (!layer.classList.contains('hint-on') || layer.dataset.tag !== tag) {
      dot.classList.add('jump');                     // appear in place, no sliding across the screen
      dot.style.left = x + 'px'; dot.style.top = y + 'px';
      void dot.offsetWidth;
      dot.classList.remove('jump');
    } else if (Math.abs(parseFloat(dot.style.left) - x) > .5 || Math.abs(parseFloat(dot.style.top) - y) > .5) {
      dot.style.left = x + 'px'; dot.style.top = y + 'px';
    }
    layer.dataset.tag = tag;
    layer.classList.add('hint-on');
  }

  // hide the hint while anything scrolls; bring it back once scrolling settles
  document.addEventListener('scroll', () => {
    if (!scrolling) { scrolling = true; updateHint(); }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { scrolling = false; updateHint(); }, 260);
  }, true);
  setInterval(() => { if (!scrolling && !drag) updateHint(); }, 700);   // safety net (fonts, late layout, rotation)
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 120));
  if (window.ResizeObserver) new ResizeObserver(layout).observe(document.documentElement);
  const mq = window.matchMedia('(orientation: portrait)');
  if (mq.addEventListener) mq.addEventListener('change', layout);
  window.addEventListener('load', () => { if (cur) syncLive(canv[cur]); });

  apply(true);
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (cur) syncLive(canv[cur]); updateHint(); });
  window.__proto = { get state() { return S; }, go, startTake, setDet };
})();
