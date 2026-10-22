(() => {
  'use strict';
  const DIM = { p: [1440, 1920], l: [1920, 1440], m: [414, 899] };
  const canv = {};
  document.querySelectorAll('.canvas').forEach(c => { canv[c.dataset.cv] = c; });

  // ---------- global state (shared by all canvases, survives rotation) ----------
  // rs: result sub-state  C = no concern selected, W = wrinkles selected (sub rows unfolded)
  const NSTEP = 7;
  const init = () => ({ screen: 'result', rs: 'C', fold: false, shelf: false, rt: 'products', hist: [], mode: 'analysis', dd: false, rec: 'products', filter: 'all',
    det: 0, fm: false, done: Array(NSTEP).fill(false) });
  let S = init();
  let cur = null;

  const screenKey = () => {
    if (S.screen !== 'rec') return S.screen;
    if (S.rec === 'products') return S.filter !== 'all' ? 'recRed' : 'recAll';
    return S.rec;
  };
  const photoKey = () => {
    if (S.mode === 'original') return 'orig';
    if (S.rs === 'X' && S.cs) return (S.mode === 'focus' ? 'f-' : 'a-') + S.cs;   // Skin Type zones highlight only; the photo stays
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

  // recommended tabs: the black pill slides to the picked tab, the card row fades/slides across, the shelf height eases
  const RT = ['products', 'routines', 'treatments'];
  function syncPill(rf, t) {
    rf.querySelectorAll('.shelf [data-name="tabs"]').forEach(tb => {
      const tab = tb.querySelector('[data-name="tab_' + t[0].toUpperCase() + t.slice(1) + '"]'), pill = tb.querySelector('.rt-pill');
      if (!tab || !pill || !tab.offsetWidth) return;
      pill.style.width = tab.offsetWidth + 'px'; pill.style.transform = 'translateX(' + tab.offsetLeft + 'px)';
    });
    if (!rf.classList.contains('pill-ready')) requestAnimationFrame(() => rf.classList.add('pill-ready'));
  }
  let rtBusy = false;
  function switchRec(t) {
    if (S.rt === t || rtBusy) return;
    const rf = canv[cur] && canv[cur].querySelector('.result-frame');
    const sh = rf && rf.querySelector('.shelf-o.cur');
    if (!sh || matchMedia('(prefers-reduced-motion: reduce)').matches) { S.rt = t; apply(); return; }
    rtBusy = true;
    const dir = Math.sign(RT.indexOf(t) - RT.indexOf(S.rt)) || 1, ease = 'cubic-bezier(.22,.8,.24,1)';
    syncPill(rf, t);
    const out = sh.querySelector('.rv-' + S.rt);
    const a = out.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-dir * 32) + 'px)' }], { duration: 150, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    a.onfinish = () => {
      const h0 = sh.offsetHeight;
      rf.classList.add('rt-anim');
      S.rt = t; apply(); a.cancel();
      const inn = sh.querySelector('.rv-' + t); inn.scrollLeft = 0;
      const h1 = sh.offsetHeight;
      if (Math.abs(h1 - h0) > 1) sh.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 420, easing: ease });
      inn.animate([{ opacity: 0, transform: 'translateX(' + (dir * 48) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: ease });
      setTimeout(() => { rf.classList.remove('rt-anim'); rtBusy = false; }, 440);
    };
  }

  // 1016: Result insight card follows the picked concern (one-line summary from the full skin report, <=150 chars)
  const INSIGHT = {
      "Radiance": "Obvious surface dullness across the cheeks and forehead is primarily influenced by surface dehydration and uneven light reflection.",
      "Moisture": "Obvious moisture loss is concentrated across the forehead and cheek areas, presenting primarily as skin dehydration rather than oil deficiency.",
      "Spots": "Moderate scattered freckles and pigmented spots are visible across the cheeks, nose bridge, and forehead area.",
      "Oiliness": "Moderate shine is primarily observed across the T-zone and central forehead, with mild surface glisten on the upper cheeks.",
      "Redness": "Moderate facial redness appears in a central distribution across both cheeks, the nose bridge, chin, and forehead.",
      "Wrinkles": "Moderate facial creasing is concentrated around the eyes and smile folds, where repeated expression and photoaging interact.",
      "Pores": "Moderate pore visibility is identified across the cheeks and central T-zone, influenced by local surface oil dynamics and surrounding dermal firmness.",
      "Eye Bag": "Moderate, symmetric under-eye fullness is visible below both eyes, showing a blend of fluid retention and structural contour features.",
      "Acne": "Moderate acne presentation characterized by scattered inflammatory papules and small comedones mainly across both cheeks and chin.",
      "Dark Circle": "Mild under-eye shadowing is present beneath both eyes, presenting a mixed pattern of subtle structural contouring and delicate vascular undertones.",
      "Firmness": "The lower face and jawline display a moderate reduction in firmness, with softer structural definition across the lower cheek contours.",
      "Texture": "Mild texture unevenness presents as fine surface granularity on the forehead along with subtle pore visibility across the T-zone.",
      "Droopy Lower Eyelid": "Mild lower eyelid laxity and expression lines are present, with normal eyelid positioning against the eye.",
      "Droopy Upper Eyelid": "Mild upper eyelid hooding is present symmetrically across both eyes without obstructing pupil exposure or the visual field.",
      "Tear Trough": "Mild structural tear trough grooves appear symmetrically under both eyes, where anatomical contours create subtle surface shadowing.",
      "Skin Type": "Combination skin profile featuring pronounced T-zone oiliness alongside dry, flushed cheeks requiring zone-specific care."
  };
  function syncInsight(rf) {
    const k = S.rs === 'X' ? S.cc : (S.rs === 'W' ? 'Wrinkles' : null);
    rf.querySelectorAll('.shelf .ins-t').forEach(t => {
      const b = t.parentElement.querySelector('.ins-b'); if (!b) return;
      if (!t.dataset.o) { t.dataset.o = t.textContent; b.dataset.o = b.textContent; }
      const nt = k && INSIGHT[k] ? k : t.dataset.o, nb = k && INSIGHT[k] ? INSIGHT[k] : b.dataset.o;
      if (t.textContent === nt && b.textContent === nb) return;
      t.textContent = nt; b.textContent = nb;
      [t, b].forEach(e => e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' }));
    });
  }

  // measurements that only work on the visible canvas
  function syncLive(c) {
    const rf = c.querySelector('.result-frame');
    if (rf) syncPill(rf, S.rt);
    if (rf) {   // height difference between the open and collapsed product shelf drives the slide
      const o = rf.querySelector('.shelf-o'), k = rf.querySelector('.shelf-c');
      if (o && k && o.offsetHeight) rf.style.setProperty('--shelf-d', (o.offsetHeight - k.offsetHeight) + 'px');
      if (o && k && o.offsetHeight) {   // concerns list never runs under the real shelf (its fade would be cut off)
        const H = rf.offsetHeight, cs = getComputedStyle(rf);
        if (!rf.dataset.cbo) { rf.dataset.cbo = parseFloat(cs.getPropertyValue('--cb-o')) || 0; rf.dataset.cbc = parseFloat(cs.getPropertyValue('--cb-c')) || 0; }
        const ov = sh => sh.offsetLeft < 250;   // landscape shelf floats on the right: it never covers the list
        rf.style.setProperty('--cb-o', (ov(o) ? Math.max(+rf.dataset.cbo, H - o.offsetTop) : +rf.dataset.cbo) + 'px');
        rf.style.setProperty('--cb-c', (ov(k) ? Math.max(+rf.dataset.cbc, H - k.offsetTop) : +rf.dataset.cbc) + 'px');
      }
      const ag = rf.querySelector('.score-blk');   // Skin Age keeps a 20px gap above the shelf, open or collapsed
      if (ag && o && k && o.offsetHeight) { ag.style.top = (o.offsetTop - ag.offsetHeight - 20) + 'px'; ag.style.setProperty('--sc-d', (k.offsetTop - o.offsetTop) + 'px'); }
    }
    const hz = c.classList.contains('cv-m');   // 1021: mobile sub-items open sideways in the horizontal concern row
    const grow = (w, on) => { if (hz) { w.style.height = ''; w.style.width = on ? w.scrollWidth + 'px' : '0px'; } else w.style.height = on ? w.scrollHeight + 'px' : '0px'; };
    c.querySelectorAll('.wr-sub').forEach(w => grow(w, S.rs === 'W' && !S.fold));
    c.querySelectorAll('.xsub').forEach(w => { const on = S.rs === 'X' && S.cc === w.dataset.for && !S.fold; w.classList.toggle('open', on); grow(w, on); });
    if (hz) {   // 1021: bring the picked concern (and its sideways sub-items) into view in the mobile row (Figma B_m5: row scrolled so it sits ~27px in)
      const key = S.rs === 'W' ? 'W' : (S.rs === 'X' ? 'X:' + S.cc : '');
      c.querySelectorAll('.result-frame .ccol > .clist').forEach(l => {
        if (!key || l.dataset.sel === key) { if (!key) l.dataset.sel = ''; return; }
        const el = S.rs === 'W' ? l.querySelector('.wr-row') : [...l.querySelectorAll('[data-cc]')].find(x => x.dataset.cc === S.cc);
        if (!el) return;
        l.dataset.sel = key;
        const sc = c._s || 1, x = (el.getBoundingClientRect().left - l.getBoundingClientRect().left) / sc + l.scrollLeft;   // element px (canvas is scaled)
        setTimeout(() => l.scrollTo({ left: Math.max(0, x - 27), behavior: 'smooth' }), 60);
      });
    }
    if (hz && rf) { const o = rf.querySelector('.shelf-o'), k = rf.querySelector('.shelf-c'); if (o && k && o.offsetHeight) { rf.style.setProperty('--shm-o', o.offsetHeight + 'px'); rf.style.setProperty('--shm-c', k.offsetHeight + 'px'); } }
    syncDet(c);
  }

  // concern filter chips: highlight the active one and name it in the list header
  function syncChips(c) {
    const on = S.filter === 'all' ? 'chip_All' : 'chip_' + S.filter;
    c.querySelectorAll('.chiprow [data-name^="chip_"]').forEach(ch => ch.classList.toggle('chip-on', ch.getAttribute('data-name') === on));
    recFill(c);
  }
  // recommendation lists: demo data reshuffled per concern (repeated items, different counts) and animated in
  const REC_IT = '[data-name^="product_"],[data-name^="step_"],[data-name^="treatment_"]';
  const NOT_IT = /^(treatment_(nonsurgical|surgical|grid)|product_grid)/;
  const isItem = el => { const n = el.getAttribute('data-name') || ''; return /^(product_|step_|treatment_)/.test(n) && !NOT_IT.test(n); };
  function recGroups(sc) {
    if (sc._rg) return sc._rg;
    const m = new Map();
    sc.querySelectorAll(REC_IT).forEach(el => {
      if (!isItem(el)) return;
      const up = el.parentElement.closest(REC_IT);
      if (up && isItem(up)) return;   // a product inside a routine step
      if (!m.has(el.parentElement)) m.set(el.parentElement, []);
      m.get(el.parentElement).push(el);
    });
    sc._rg = [...m].map(([p, its]) => ({ p, its: its.map(x => x.cloneNode(true)), kind: its[0].getAttribute('data-name').split('_')[0] }));
    return sc._rg;
  }
  function recFill(c) {
    const f = S.filter;
    if (c._rf === f) return;
    const first = c._rf === undefined; c._rf = f;
    const ORDER = ['Redness', 'Droopy Lower Eyelid', 'Oiliness', 'Spots', 'Dark Circle', 'Droopy Upper Eyelid', 'Tear Trough', 'Pores',
                   'Moisture', 'Wrinkles', 'Texture', 'Eye Bag', 'Firmness', 'Radiance', 'Acne'];
    const NP = [4, 3, 5, 2, 6, 3, 5, 4, 6, 2, 5, 3, 4, 6, 2];
    const TR = [6, 4, 7, 5, 3, 6, 4, 7, 5, 3, 6, 4, 7, 5, 3];   // routine steps (morning + night)
    const TT = [4, 6, 3, 7, 2, 5, 8, 3, 6, 4, 7, 2, 5, 8, 3];   // treatments (non-surgical + surgical)
    const PERM = [[0, 1, 2, 3], [2, 0, 3, 1], [3, 2, 1, 0], [1, 3, 0, 2], [2, 3, 0, 1], [3, 0, 2, 1], [1, 2, 3, 0]];
    const MASK = { 4: [[0, 1, 2, 3]], 3: [[0, 2, 3], [0, 1, 3], [1, 2, 3], [0, 1, 2]], 2: [[0, 3], [0, 2], [1, 3], [0, 1]], 1: [[0], [2], [1], [3]] };
    const split = (t, i) => { const a = Math.min(4, Math.ceil(t / 2)); return i === 0 ? a : Math.max(1, t - a); };
    const ix = Math.max(0, ORDER.indexOf(f));
    c.querySelectorAll('section[data-screen="recRed"],section[data-screen="routines"],section[data-screen="treatments"]').forEach(sc => {
      const key = sc.dataset.screen, gs = recGroups(sc);
      if (first && f === 'all') return;
      let tot = 0;
      gs.forEach((g, i) => {
        const T = g.its; let list = [];
        const P = PERM[(ix + i * 3) % PERM.length], pick = n => { const r = []; for (let k = 0; k < n; k++) r.push(T[P[k % P.length] % T.length]); return r; };
        if (f === 'all') list = T;
        else if (g.kind === 'product') list = pick(NP[ix]);
        else if (g.kind === 'step') { const n = split(TR[ix], i), ms = MASK[n]; list = ms[(ix + i) % ms.length].filter(k => k < T.length).map(k => T[k]); }
        else list = pick(split(TT[ix], i));
        [...g.p.children].forEach(x => { if (isItem(x)) x.remove(); });
        list.forEach((t, k) => { const el = t.cloneNode(true); el.classList.add('rec-in'); el.style.animationDelay = (k * 60) + 'ms'; g.p.appendChild(el); });
        tot += list.length;
      });
      const p = sc.querySelector('[data-name="result_count"] p');
      if (p) { if (!p.dataset.o) p.dataset.o = p.textContent; p.textContent = f === 'all' ? p.dataset.o : f + '  ·  ' + tot + ' ' + (key === 'recRed' ? 'products' : key); }
    });
  }

  // concern detail: tab pager
  function syncDet(c, animate) {
    const sc = c.querySelector('.screen[data-screen="detail"]'); if (!sc) return;
    const track = sc.querySelector('.det-track'), pager = sc.querySelector('.det-pager');
    sc.querySelectorAll('.dtab').forEach((t, i) => t.classList.toggle('dt-on', i === S.det));
    const on = sc.querySelector('.dtab.dt-on'), ul = sc.querySelector('.det-ul');
    if (on && ul && ul.offsetParent && on.offsetWidth) {
      const s = c._s || 1, b = ul.offsetParent.getBoundingClientRect();
      // size to the text itself (widest line), not the label's block box
      const rg = document.createRange(); rg.selectNodeContents(on);
      let l = 1e9, r = -1e9;
      [...rg.getClientRects()].forEach(q => { if (q.width) { l = Math.min(l, q.left); r = Math.max(r, q.right); } });
      if (r < l) { const a = on.getBoundingClientRect(); l = a.left; r = a.right; }
      ul.style.left = ((l - b.left) / s) + 'px';
      ul.style.width = ((r - l) / s) + 'px';
    }
    const ov = sc.querySelector('.det-ov'); if (ov) ov.classList.toggle('fm-on', S.fm);
    sc.querySelectorAll('.vt-opt').forEach(o => o.classList.toggle('vt-on', (o.dataset.name === 'opt_Focus') === S.fm));
  }

  // ---------- render state into every canvas ----------
  function apply(resetScroll) {
    setTimeout(() => fadeAll(), 560);
    const key = screenKey();
    if (S.mode === 'focus' && S.rs === 'C') S.mode = 'analysis';
    for (const cv in canv) {
      const c = canv[cv];
      c.classList.toggle('f-red', S.filter !== 'all');
      syncChips(c);
      c.querySelectorAll(':scope > .screen').forEach(sc => {
        const on = sc.dataset.screen === key;
        if (sc.classList.contains('active') && !on) {          // keep the old page under the new one while it fades in
          sc.classList.add('leaving'); clearTimeout(sc._lv);
          sc._lv = setTimeout(() => sc.classList.remove('leaving'), 420);
        }
        if (on) { clearTimeout(sc._lv); sc.classList.remove('leaving'); }
        sc.classList.toggle('active', on);
        if (on && resetScroll) { const sr = sc.querySelector('.scroller'); if (sr) sr.scrollTop = 0; }
      });
      const rf = c.querySelector('.result-frame');
      if (rf) {
        ['C', 'W', 'X'].forEach(s => rf.classList.toggle('s-' + s, S.rs === s));
        rf.querySelectorAll('.crow').forEach(r => r.classList.toggle('csel', S.rs === 'X' && r.dataset.cc === S.cc));
        rf.querySelectorAll('.srow').forEach(r => r.classList.toggle('ssel', !!S.sub && r.dataset.sub === S.sub && S.rs !== 'C'));
        rf.classList.toggle('has-subsel', !!S.sub && S.rs !== 'C');
        rf.classList.toggle('st-on', S.rs === 'X' && S.cc === 'Skin Type');
        rf.classList.toggle('fold', !!S.fold);
        const lg = rf.querySelector('.legend');
        if (lg) {
          const pill = lg.querySelector('.lg-pill'), nm = lg.querySelector('.lg-name'), bar = lg.querySelector('.lg-bar');
          if (!lg._w && nm) lg._w = nm.textContent;
          const row = S.rs === 'X' ? rf.querySelector('.crow[data-cc="' + S.cc + '"]') : null;
          const col = row ? getComputedStyle(row).getPropertyValue('--cc').trim() : '';
          if (row && col) {
            if (nm) nm.textContent = S.cc;
            if (pill) pill.style.background = col;
            if (bar) bar.style.background = 'linear-gradient(to top, color-mix(in srgb, ' + col + ' 35%, white), color-mix(in srgb, ' + col + ' 80%, black))';
          } else if (S.rs === 'W') {
            if (nm && lg._w) nm.textContent = lg._w;
            if (pill) pill.style.background = ''; if (bar) bar.style.background = '';
          }
        }
        ['analysis', 'focus', 'original'].forEach(m => rf.classList.toggle('m-' + m, S.mode === m));
        rf.classList.toggle('shelf-open', S.shelf);
        syncInsight(rf);
        ['products', 'routines', 'treatments'].forEach(t => rf.classList.toggle('rt-' + t, S.rt === t));
        rf.querySelectorAll('.shelf').forEach(g => g.classList.toggle('cur', g.classList.contains(S.shelf ? 'shelf-o' : 'shelf-c')));
        rf.classList.toggle('dd-open', S.dd);
        const pk = photoKey();
        const pim = rf.querySelector('.ph-' + pk);
        if (pim && !pim.getAttribute('src') && pim.dataset.src) pim.src = pim.dataset.src;   // concern photos load on demand
        rf.querySelectorAll('.ph').forEach(im => im.classList.toggle('on', im === pim));
        rf.classList.toggle('no-focus', S.rs === 'C');
        rf.querySelectorAll('.dd-row').forEach(row => {
          const sel = row.dataset.mode === S.mode;
          row.classList.toggle('sel', sel);
          const dot = row.querySelector('img');
          if (dot) dot.src = sel ? 'assets/56d90.svg' : 'assets/2df40.svg';
        });
      }
      if (cv === cur) syncLive(c); else { c.querySelectorAll('.wr-sub').forEach(w => { if (S.rs !== 'W' || S.fold) w.style.height = '0px'; }); c.querySelectorAll('.xsub').forEach(w => { if (!(S.rs === 'X' && S.cc === w.dataset.for) || S.fold) w.style.height = '0px'; }); }
    }
    motion(520);
    requestAnimationFrame(() => { if (cur) syncDet(canv[cur]); });
    setTimeout(() => { if (cur) syncDet(canv[cur]); updateHint(); }, 540);
  }
  function revealSkinType() { setTimeout(() => { const l = canv[cur] && canv[cur].querySelector('.clist'); if (l) smoothTo(l, 0); }, 60); }
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
  function backToReport() {
    S.screen = 'report'; S.dd = false; apply(false);
    document.querySelectorAll('.screen[data-screen="report"] .scroller').forEach(sr => { sr.scrollTop = +(sr.dataset.keep || 0); });
  }
  // 1020: one detail screen, content swapped per concern (Wrinkles lives in <template class="det-tpl">)
  function swapDet() {
    const dc = S.dc || 'Redness';
    document.querySelectorAll('.screen[data-screen="detail"]').forEach(sc => {
      if ((sc.dataset.dc || 'Redness') === dc) return;
      const sr = sc.querySelector('.scroller'), tpl = sc.querySelector('template.det-tpl[data-dc="' + dc + '"]');
      if (!sc._red) sc._red = sr.innerHTML;
      sr.innerHTML = dc === 'Redness' ? sc._red : (tpl ? tpl.innerHTML : sc._red);
      sr.scrollTop = 0; sc.dataset.dc = dc;
    });
  }
  function go(screen, opts = {}) {
    if (screen !== S.screen && S.screen !== 'take') S.hist.push(S.screen);   // back returns to whichever page this one was opened from
    if (S.screen === 'report') document.querySelectorAll('.screen[data-screen="report"] .scroller').forEach(sr => { sr.dataset.keep = sr.scrollTop; });
    S.screen = screen;
    if (opts.rec) S.rec = opts.rec;
    if (opts.filter) S.filter = opts.filter;
    if (screen === 'detail') { S.det = 0; S.fm = false; spyTarget = null; swapDet(); }
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
    if (isBack(name)) {   // report / concern detail / recommendations / get report: back to the page it was opened from
      const prev = S.hist.pop() || (S.screen === 'share' ? null : 'result');
      if (!prev) startTake();
      else if (prev === 'report') backToReport();   // keeps the report's scroll position
      else { if (S.screen === 'report') document.querySelectorAll('.screen[data-screen="report"] .scroller').forEach(sr => { sr.dataset.keep = sr.scrollTop; }); S.screen = prev; S.dd = false; apply(prev === 'result'); }
      return true;
    }
    if (isHome(name)) { if (S.screen === 'share') startTake(); return true; }   // Home only works on Download Report (restarts the camera); elsewhere it would open the landing page, not part of this demo
    if (S.screen === 'result') {
      if (el.classList && el.classList.contains('dd-row')) {
        if (el.dataset.mode === 'focus' && S.rs === 'C') return true;   // focus needs a selected concern
        S.mode = el.dataset.mode; advance(1); if (!modeAt) { modeAt = Date.now(); setTimeout(updateHint, 2050); } apply(); return true;   // dropdown stays open
      }
      if (isGlasses(name)) { S.dd = !S.dd; if (!modeAt) { modeAt = Date.now(); setTimeout(updateHint, 2050); } apply(); return true; }   // View Report hint 2s after the first preview-mode tap
      if (name === 'handelr') { S.shelf = !S.shelf; if (S.shelf) advance(0); apply(); return true; }
      if (/^AI_Insight/.test(name) && el.closest && el.closest('.result-frame .shelf')) { S.shelf = !S.shelf; if (S.shelf) advance(0); apply(); return true; }   // 1021b: summary card toggles the shelf, like the handle
      // 1016 concern rules: one filled circle; re-tapping a selected circle does nothing; the − badge folds the group back
      const clearSel = () => { S.rs = 'C'; S.cc = null; S.cs = null; S.sub = null; S.fold = false; if (S.mode === 'focus') S.mode = 'analysis'; apply(); };
      const isMinus = name === 'badge_minus' || (el.classList && el.classList.contains('st-minus'));
      const isPlus = name === 'badge_plus' || (el.classList && el.classList.contains('st-plus'));
      if (isMinus) { S.fold = true; if (S.cc !== 'Skin Type') S.sub = null; apply(); return true; }   // − folds the rows; the concern stays selected
      if (isPlus && S.fold && (el.closest('.wr-row') ? S.rs === 'W' : (el.closest('.st-type') ? S.cc === 'Skin Type' : (el.closest('.crow') && S.rs === 'X' && S.cc === el.closest('.crow').dataset.cc)))) {
        S.fold = false; apply(); if (S.rs === 'W') revealWrinkles(); return true;
      }
      if (name === 'row_Skin Score') { if (S.rs !== 'C') clearSel(); return true; }   // Skin Score = overall view
      if (name === 'row_Wrinkles' || (name === 'badge_plus' && el.closest('.wr-row'))) {
        if (S.rs !== 'W') { S.rs = 'W'; S.cc = null; S.cs = null; S.sub = null; S.fold = false; apply(); revealWrinkles(); }
        else if (S.sub) { S.sub = null; apply(); }
        return true;
      }
      const sr = el.closest && el.closest('.srow');
      if (sr) { if (S.sub !== sr.dataset.sub) { S.sub = sr.dataset.sub; apply(); } return true; }   // sub rows: re-tap keeps the selection; the photo stays
      if (el.closest && el.closest('.st-type')) {
        if (!(S.rs === 'X' && S.cc === 'Skin Type')) { S.rs = 'X'; S.cc = 'Skin Type'; S.cs = 'skintype'; S.sub = 'Full Face'; S.fold = false; apply(); revealSkinType(); }
        return true;
      }
      const rc = el.closest && el.closest('.crow');
      if (rc) {
        if (S.rs === 'X' && S.cc === rc.dataset.cc) { if (S.sub) { S.sub = null; apply(); } return true; }   // re-tap keeps it selected
        S.rs = 'X'; S.cc = rc.dataset.cc; S.cs = rc.dataset.slug || null; S.sub = null; S.fold = false;
        apply(); return true;
      }
      if (name === 'btn_view_report') { advance(2); go('report'); return true; }
      if (name === 'btn_retake') { startTake(); return true; }
      const rtm = /^tab_(Products|Routines|Treatments)/.exec(name);
      if (rtm) { switchRec(rtm[1].toLowerCase()); return true; }   // swaps only the card row; concerns / photo / insight keep their state
      return false;
    }
    if (name === 'concern_card_Redness') { advance(3); S.dc = 'Redness'; go('detail'); return true; }
    if (name === 'concern_card_Wrinkles') { S.dc = 'Wrinkles'; go('detail'); return true; }   // 1020: Wrinkles detail (template variant)
    if (name === 'btn_matching_products') { advance(4); go('rec', { rec: 'products', filter: S.dc || 'Redness' }); return true; }
    if (name === 'tab_Report') { if (S.screen !== 'report') go('report'); return true; }
    if (name === 'tab_Recommendation') { go('rec', { rec: 'products', filter: 'all' }); return true; }
    if (name === 'tab_Get Report') { advance(4); advance(5); if (S.screen !== 'share') go('share'); return true; }
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
      const cm = /^chip_(.+)$/.exec(name);
      if (cm) {   // every concern chip filters (products list is shared demo data)
        const f = cm[1] === 'All' ? 'all' : cm[1];
        if (S.filter !== f) { const flip = (S.filter === 'all') !== (f === 'all'); S.filter = f; apply(S.rec === 'products' && flip); }
        return true;
      }
    }
    return false;
  }
  // detail tabs scroll the page to their section (sections are stacked; the tab row is sticky)
  const DGAP = { p: 40, l: 40, m: 31 };   // 1022l: hairline -> content gap per Report_p2_new
  let detLock = false;   // set by a tab tap; released by the next manual scroll gesture
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { detLock = false; }, { capture: true, passive: true }));
  function detGeo(c) {
    const sc = c.querySelector('.screen[data-screen="detail"]'); if (!sc) return null;
    const sr = sc.querySelector('.scroller'), st = sc.querySelector('.det-stick');
    if (!sr || !st) return null;
    const s = c._s || 1, r0 = sr.getBoundingClientRect().top;
    const top = parseFloat(getComputedStyle(st).top) || 0;
    const off = top + st.offsetHeight + DGAP[c.dataset.cv];
    const secs = [...sc.querySelectorAll('.det-panel')].map(p => (p.getBoundingClientRect().top - r0) / s + sr.scrollTop);
    return { sr, off, secs };
  }
  // 1022l: scroll spy never skips a tab — a jump of 2 slides through the middle tab (120ms per step)
  let spyTarget = null, spyTimer = 0;
  function spyStepTo(t) {
    spyTarget = t; if (spyTimer) return;
    const step = () => {
      spyTimer = 0;
      if (S.screen !== 'detail' || detLock || spyTarget === null || S.det === spyTarget) return;
      S.det += Math.sign(spyTarget - S.det); syncDet(canv[cur]);
      if (S.det !== spyTarget) spyTimer = setTimeout(step, 120);
    };
    step();
  }
  // 1022l: which section is "being read" — reading line 1/3 down the area below the pinned tabs;
  // sections too far down to ever reach that line share the last stretch of scroll evenly (the last one = bottom)
  function spyIndex(g) {
    const y = g.sr.scrollTop, max = g.sr.scrollHeight - g.sr.clientHeight;
    const line = g.off + (g.sr.clientHeight - g.off) / 3;
    const T = g.secs.map(v => v - line);
    const j = T.findIndex(t => t > max - 2);
    if (j > 0) {
      const A = Math.max(T[j - 1], max - g.sr.clientHeight / 2), n = T.length;
      for (let k = j; k < n; k++) T[k] = A + (max - A) * (k - j + 1) / (n - j);
    }
    let i = 0;
    T.forEach((t, k) => { if (y >= t - 2) i = k; });
    return i;
  }
  function setDet(i) {
    i = Math.max(0, Math.min(2, i));
    clearTimeout(spyTimer); spyTimer = 0; spyTarget = null;
    S.det = i; syncDet(canv[cur]);
    const g = detGeo(canv[cur]); if (!g) return;
    setTimeout(() => { detLock = true; }, 0);
    // 1016: the last section can't reach the pinned tabs on its own — add a temporary tail so it can
    let tail = g.sr.querySelector('.det-tail');
    if (!tail) { tail = document.createElement('div'); tail.className = 'det-tail'; tail.style.cssText = 'height:0;flex-shrink:0;pointer-events:none'; const last = [...g.sr.querySelectorAll('.det-panel')].pop(); (last && last.parentElement ? last.parentElement : g.sr).appendChild(tail); }
    const need = (g.secs[i] - g.off) - (g.sr.scrollHeight - g.sr.clientHeight);
    if (need > 0) tail.style.height = (parseFloat(tail.style.height) || 0) + need + 'px';
    g.sr.scrollTo({ top: Math.max(0, Math.min(g.secs[i] - g.off, g.sr.scrollHeight - g.sr.clientHeight)), behavior: 'smooth' });
  }
  document.addEventListener('scroll', e => {   // underline follows the section under the pinned tabs
    if (S.screen !== 'detail' || !cur || detLock) return;
    const t = e.target; if (!t.classList || !t.classList.contains('scroller') || !t.closest('.screen[data-screen="detail"]')) return;
    const g = detGeo(canv[cur]); if (!g) return;
    { const tl = g.sr.querySelector('.det-tail'), th = tl ? parseFloat(tl.style.height) || 0 : 0;   // drop the tail once it is out of view
      if (th && g.sr.scrollTop + g.sr.clientHeight < g.sr.scrollHeight - th - 2) tl.style.height = '0px'; }
    const i = spyIndex(g);
    if (i !== S.det || spyTimer) spyStepTo(i);
  }, true);

  let swallowClick = false, tapUntil = 0;
  // 1016: a tap near a visible +/− badge counts as that badge (the badges are tiny on the scaled canvas)
  function nearBadge(target, x, y) {
    if (x == null) return target;
    const s = (canv[cur] && canv[cur]._s) || 1, R = (cur === 'm' ? 32 : 56) * s;   // 1021f: bigger +/- tap area (Wrinkles, Pores, Skin Type)
    let col = target.closest && target.closest('.result-frame .ccol');
    if (!col) {   // a finger just outside the concern column/row (e.g. above the mobile row) still reaches its +/- badges
      col = [...document.querySelectorAll('.canvas.active .result-frame .ccol')].find(c => { const r = c.getBoundingClientRect();
        return r.width > 0 && x >= r.left - R && x <= r.right + R && y >= r.top - R && y <= r.bottom + R; });
      if (!col) return target;
    }
    let best = null, bd = 1e9;
    col.querySelectorAll('[data-name^="badge_"], .st-plus, .st-minus').forEach(bg => {
      if (getComputedStyle(bg).display === 'none') return;
      if (bg.closest(S.rs === 'W' ? '.wr-x' : '.wr-w')) return;   // the folded / unfolded Wrinkles rows sit on top of each other
      if (bg.checkVisibility && !bg.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return;
      const r = bg.getBoundingClientRect(); if (r.width < 1) return;
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) - r.width / 2;
      if (d < R && d < bd) { bd = d; best = bg; }
    });
    return best || target;
  }
  function dispatchTap(target, x, y) {
    let n = nearBadge(target, x, y);
    const insideDd = n.closest && (n.closest('.dd') || n.closest('[data-name^="btn_skincarepro_compare_s"],[data-name^="btn_skincarepro_previewmodes"]'));
    if (S.dd && !insideDd) { S.dd = false; apply(); }   // tap outside closes the dropdown and still acts on what was tapped
    while (n && n.id !== 'stage') {
      const name = n.getAttribute && n.getAttribute('data-name');
      if ((name || (n.classList && n.classList.contains('dd-row'))) && handle(name || '', n)) return;
      n = n.parentElement;
    }
  }
  document.getElementById('stage').addEventListener('click', e => {
    if (swallowClick) { swallowClick = false; return; }
    if (Date.now() < tapUntil) return;   // already handled on touchend
    if (S.screen === 'result' && S.shelf && e.target.closest &&   // 1021f: a tap on empty space (photo) closes the open shelf
        !e.target.closest('.result-frame .shelf, .result-frame .ccol, .result-frame .st-type, [data-name^="btn"], [data-name*="back"], [data-name*="home"], [data-name="dropdown_photo_mode"], .vt-opt, .hint-layer')) {
      S.shelf = false; apply(); return;
    }
    dispatchTap(e.target, e.clientX, e.clientY);
  });
  // 1016: concern column taps fire on touchend (a tiny finger drift inside the scroll list used to cancel the click)
  let tp = null;
  document.addEventListener('touchstart', e => {
    const t = e.touches[0], col = e.target.closest && e.target.closest('.result-frame .ccol');
    if (!col || e.touches.length > 1) { tp = null; return; }
    const l = col.querySelector('.clist');
    tp = { x: t.clientX, y: t.clientY, el: e.target, l, st: l ? l.scrollTop : 0, t: Date.now() };
  }, { passive: true });
  document.addEventListener('touchmove', e => { if (!tp) return; const t = e.touches[0]; tp.m = Math.max(tp.m || 0, Math.hypot(t.clientX - tp.x, t.clientY - tp.y)); }, { passive: true });
  document.addEventListener('touchend', () => {
    const d = tp; tp = null;
    if (!d || (d.m || 0) > 14 || Date.now() - d.t > 700) return;
    tapUntil = Date.now() + 600; dispatchTap(d.el, d.x, d.y);
  }, { passive: true });
  document.addEventListener('touchcancel', () => { tp = null; }, { passive: true });

  // product shelf: tap the handle area or drag it down / up to collapse / open
  let sd = null;
  document.addEventListener('pointerdown', e => {
    if (S.screen !== 'result') return;
    const sh = e.target.closest && e.target.closest('.result-frame .shelf.cur');
    if (!sh) return;
    const s = canv[cur]._s || 1, zone = (cur === 'm' ? 44 : 96) * s;
    if (e.clientY - sh.getBoundingClientRect().top > zone) return;
    sd = { y: e.clientY, sh, id: e.pointerId, on: false };
  });
  document.addEventListener('pointermove', e => {
    if (!sd || e.pointerId !== sd.id) return;
    const dy = (e.clientY - sd.y) / (canv[cur]._s || 1);
    if (!sd.on) { if (Math.abs(dy) < 8) return; sd.on = true; sd.sh.style.transition = 'none'; }
    const v = S.shelf ? Math.max(0, dy) : Math.min(0, dy * 0.4);
    sd.sh.style.transform = `translateY(${v}px)`;
  });
  const endShelf = e => {
    if (!sd || (e && e.pointerId !== sd.id)) return;
    const d = sd; sd = null;
    d.sh.style.transition = ''; d.sh.style.transform = '';
    if (!d.on) return;
    swallowClick = true; setTimeout(() => { swallowClick = false; }, 60);
    const dy = ((e ? e.clientY : d.y) - d.y) / (canv[cur]._s || 1);
    if (S.shelf && dy > 40) { S.shelf = false; apply(); }
    else if (!S.shelf && dy < -40) { S.shelf = true; advance(0); apply(); }
  };
  document.addEventListener('dragstart', e => { if (e.target.closest && e.target.closest('.shelf')) e.preventDefault(); });   // native image drag would cancel the pointer drag
  // recommended card rows: mouse drag scrolls sideways (touch scrolls natively)
  let rd = null;
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || S.screen !== 'result') return;
    const r = e.target.closest && e.target.closest('.result-frame .shelf.cur .rv');
    if (r) rd = { r, x: e.clientX, l: r.scrollLeft, on: false };
  });
  document.addEventListener('pointermove', e => {
    if (!rd) return;
    const dx = (e.clientX - rd.x) / (canv[cur]._s || 1);
    if (!rd.on && Math.abs(dx) < 6) return;
    rd.on = true; rd.r.scrollLeft = rd.l - dx;
  });
  document.addEventListener('pointerup', () => { if (rd && rd.on) { swallowClick = true; setTimeout(() => { swallowClick = false; }, 60); } rd = null; });
  document.addEventListener('pointerup', endShelf);
  document.addEventListener('pointercancel', endShelf);

  // swipe between the concern-detail tabs
  let drag = null;
  document.addEventListener('pointerdown', e => {
    return;   // 1016: sections stack vertically now; no sideways swipe
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
      case 0: return S.shelf ? null : firstVis(sc, '.shelf.cur [data-name="handelr"]');   // 1016: See All Recommendations first, then preview modes
      case 1: if (modeAt && Date.now() - modeAt >= 2000) return null; return S.dd ? firstVis(sc, '.dd-row:not(.sel):not([data-mode="focus"]), .result-frame.s-W .dd-row[data-mode="focus"]:not(.sel)') : firstVis(sc, '[data-name^="btn_skincarepro_compare_s"], [data-name^="btn_skincarepro_previewmodes"]');
      case 2: return (modeAt && Date.now() - modeAt >= 2000) ? firstVis(sc, '[data-name="btn_view_report"]') : null;
      case 3: return firstVis(sc, '[data-name="concern_card_Redness"]');
      case 4: return firstVis(sc, '.fixedlayer [data-name="tab_Get Report"]');   // 1016: concern detail points at Get Report in the navigator
      case 5: return firstVis(sc, '.fixedlayer [data-name="tab_Get Report"]');
      case 6: return firstVis(sc, ':is([data-name^="btn_skincarepro_home"],[data-name^="btn_y4b_skincarecm_home"])');
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
    autoScrollUntil = Date.now() + 900; motion(900);
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

  // hints only show on a still page: any scroll, finger drag or page/state transition hides them,
  // and they come back once nothing has moved for QUIET ms
  const QUIET = 450;
  let scrolling = false, scrollTimer = null, quietUntil = 0, quietTimer = null;
  function motion(ms = QUIET) {
    quietUntil = Math.max(quietUntil, Date.now() + ms);
    clearTimeout(quietTimer);
    quietTimer = setTimeout(updateHint, quietUntil - Date.now() + 20);
    const l = cur && canv[cur].querySelector('.hint-layer'); if (l) l.classList.remove('hint-on');
  }
  function updateHint() {
    if (!cur) return;
    if (scrolling || drag || Date.now() < quietUntil) { const l = canv[cur].querySelector('.hint-layer'); if (l) l.classList.remove('hint-on'); return; }
    for (const cv in canv) if (cv !== cur) { const l = canv[cv].querySelector('.hint-layer'); if (l) l.classList.remove('hint-on'); }
    const c = canv[cur], layer = c.querySelector('.hint-layer'), dot = layer.querySelector('.hint');
    const t = hintTarget(c);
    if (t) scheduleReveal(t, c);
    if (!t || scrolling) { layer.classList.remove('hint-on'); return; }
    const s = c._s || 1, cr = c.getBoundingClientRect(), r = t.getBoundingClientRect();
    const x = (r.left - cr.left + r.width / 2) / s, y = (r.top - cr.top + r.height / 2) / s;
    if (y < 0 || y > DIM[cur][1]) { layer.classList.remove('hint-on'); return; }
    { const top = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).find(e => !e.closest('.hint-layer'));   // hidden under a sticky bar / tab bar: no hint
      if (top && !t.contains(top) && !top.contains(t)) { layer.classList.remove('hint-on'); return; } }
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
  // concerns list fade mask (Figma 4754:25737): top once scrolled, bottom while more content is below
  function syncFade(l) {
    if (l.closest('.cv-m')) {   // 1021: mobile concerns are a horizontal row — fade left / right edges instead
      l.classList.toggle('fade-t', l.scrollLeft > 2);
      l.classList.toggle('fade-b', l.scrollLeft + l.clientWidth < l.scrollWidth - 2);
    } else {
    l.classList.toggle('fade-t', l.scrollTop > 2);
    l.classList.toggle('fade-b', l.scrollTop + l.clientHeight < l.scrollHeight - 2);
    }
  }
  const fadeAll = () => document.querySelectorAll('.clist').forEach(syncFade);
  document.addEventListener('scroll', e => {
    if (e.target.classList && e.target.classList.contains('clist')) syncFade(e.target);
    if (!scrolling) { scrolling = true; updateHint(); }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { scrolling = false; motion(); }, 160);
  }, true);
  // a finger moving on the page counts as motion even before the page starts scrolling
  let touchY = null;
  document.addEventListener('touchstart', e => { touchY = e.touches[0] ? e.touches[0].clientY : null; }, { passive: true });
  document.addEventListener('touchmove', e => {
    const t = e.touches[0]; if (t && touchY !== null && Math.abs(t.clientY - touchY) > 6) motion();
  }, { passive: true });
  setInterval(() => { fadeAll(); if (!scrolling && !drag) updateHint(); }, 700);   // safety net (fonts, late layout, rotation)
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 120));
  if (window.ResizeObserver) new ResizeObserver(layout).observe(document.documentElement);
  const mq = window.matchMedia('(orientation: portrait)');
  if (mq.addEventListener) mq.addEventListener('change', layout);
  window.addEventListener('load', () => { if (cur) syncLive(canv[cur]); });

  apply(true);
  layout();
  startTake();   // the demo always opens on the photo step
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (cur) syncLive(canv[cur]); updateHint(); });
  function preloadPhotos() {
    const imgs = [...document.querySelectorAll('.canvas.active .ph[data-src]')].filter(im => !im.getAttribute('src'));
    let i = 0;
    const next = () => { if (i >= imgs.length) return; const im = imgs[i++]; im.addEventListener('load', next, { once: true }); im.addEventListener('error', next, { once: true }); im.src = im.dataset.src; };
    for (let k = 0; k < 4; k++) next();
  }
  window.addEventListener('load', () => setTimeout(preloadPhotos, 300));
  window.addEventListener('resize', () => setTimeout(preloadPhotos, 600));
  window.__proto = { get state() { return S; }, go, startTake, setDet };
})();

// 1022f: pressed state for Elevated concern cards (class, so it also shows on iOS where :active is unreliable)
(function () {
  let on = null;
  const off = () => { if (on) { on.classList.remove('is-pressed'); on = null; } };
  document.addEventListener('pointerdown', e => { const c = e.target.closest && e.target.closest('.cc-elev'); if (!c) return; off(); on = c; c.classList.add('is-pressed'); }, { capture: true, passive: true });
  ['pointerup', 'pointercancel', 'scroll'].forEach(ev => document.addEventListener(ev, () => setTimeout(off, 90), { capture: true, passive: true }));
})();
