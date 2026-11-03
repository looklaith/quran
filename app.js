const $ = id => document.getElementById(id);
const S = { page: 1, ayahs: [], sel: -1, loadId: 0, audio: null, surahs: null };
const cache = {};
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }
};
// Number shown on screen: in Al-Fatihah the Bismillah is an unnumbered heading, so verses shift down by one.
const shownNo = a => a.surah.number === 1 ? a.numberInSurah - 1 : a.numberInSurah;
const JUZ = ['الأَوَّلُ', 'الثَّانِي', 'الثَّالِثُ', 'الرَّابِعُ', 'الخَامِسُ', 'السَّادِسُ', 'السَّابِعُ', 'الثَّامِنُ', 'التَّاسِعُ', 'العَاشِرُ',
  'الحَادِي عَشَرَ', 'الثَّانِي عَشَرَ', 'الثَّالِثَ عَشَرَ', 'الرَّابِعَ عَشَرَ', 'الخَامِسَ عَشَرَ', 'السَّادِسَ عَشَرَ', 'السَّابِعَ عَشَرَ', 'الثَّامِنَ عَشَرَ', 'التَّاسِعَ عَشَرَ', 'العِشْرُونَ',
  'الحَادِي وَالعِشْرُونَ', 'الثَّانِي وَالعِشْرُونَ', 'الثَّالِثُ وَالعِشْرُونَ', 'الرَّابِعُ وَالعِشْرُونَ', 'الخَامِسُ وَالعِشْرُونَ', 'السَّادِسُ وَالعِشْرُونَ', 'السَّابِعُ وَالعِشْرُونَ', 'الثَّامِنُ وَالعِشْرُونَ', 'التَّاسِعُ وَالعِشْرُونَ', 'الثَّلَاثُونَ'];
const ar = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
// Text from outside APIs is never trusted as HTML: turn < > & " into harmless characters first.
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- Quran data ----------
// The whole Quran, tafsir and translations ship with the app in /data, and the service worker
// keeps them on the phone, so reading works with no internet.
// quran.json = { s: [[name, englishName, ayahCount]], a: [[text, surah, numberInSurah, page, juz]] }
// <edition>.json = one string per ayah, in the same global order.
const EDITIONS = ['ar.muyassar', 'en.sahih', 'fr.hamidullah', 'ur.jalandhry', 'tr.diyanet'];
const json = url => fetch(url).then(r => { if (!r.ok) throw new Error('bad'); return r.json(); });
function db() {
  if (!cache.db) {
    cache.db = json('/data/quran.json').then(d => {
      const surahs = d.s.map((x, i) => ({ number: i + 1, name: x[0], englishName: x[1], numberOfAyahs: x[2] }));
      const pages = [], firstPage = [];
      d.a.forEach((x, i) => {
        const a = { number: i + 1, text: x[0], surah: surahs[x[1] - 1], numberInSurah: x[2], page: x[3], juz: x[4] };
        (pages[a.page] = pages[a.page] || []).push(a);
        if (a.numberInSurah === 1) firstPage[x[1]] = a.page;
      });
      return { surahs, pages, firstPage };
    }).catch(e => { delete cache.db; throw e; });
  }
  return cache.db;
}
const quran = p => db().then(d => d.pages[p]);
// lines.json = the printed Madani Mushaf layout (15 lines a page, 8 on pages 1-2), one entry per page.
// Each line is ["h", surah] (surah title), ["b"] (Bismillah), or [[ayahNumber, words, endsHere], ...].
function layout(p) {
  if (!cache.lines) cache.lines = json('/data/lines.json').catch(e => { delete cache.lines; throw e; });
  return cache.lines.then(l => l[p]);
}
const surahPage = n => db().then(d => { const p = d.firstPage[n]; if (!p) throw new Error('bad'); return p; });
function edition(ed) {
  if (!EDITIONS.includes(ed)) return Promise.reject(new Error('bad'));
  if (!cache[ed]) cache[ed] = json('/data/' + ed + '.json').catch(e => { delete cache[ed]; throw e; });
  return cache[ed];
}
// Tajweed text comes from Quran.com, word by word (HTML tag per rule), with the same line numbers
// as lines.json. Keyed by "line:ayahNumber" -> the tajweed words of that ayah on that line.
const tjCache = {};
// Only the letters of a text (no tags, marks, spaces or kashida), to check that the tajweed words and
// the Mushaf words are the same words. Yeh and hamza are left out: the two sources write them in
// different ways (e.g. هَدَىٰكُمۡ), which is spelling, not a different word.
const bareLetters = s => s.replace(/<[^>]+>/g, '').replace(/[^آ-ؿف-ىيٱ-ۓ]|[يىیء]/g, '');
// iPhone Safari stops joining two letters where a colour starts or ends, so a word like يَعۡقِلُونَ
// falls apart into ى عقلون. A zero-width joiner on both sides of the colour change keeps the two
// letters joined. Added only where they really join: the letter before joins forward (not ا د ذ ر ز و)
// and the next character is a letter (a colour change before a vowel mark is left as it is).
const ZWJ_JOIN = 'بتثجحخسشصضطظعغفقكلمنهيئیـ', ZWJ_MARK = /[ً-ٰٟۖ-ۭ]/,
      ZWJ_NEXT = /[آ-يٱ-ۓ]/;
// Quran.com often puts a colour change between a letter and its vowel marks (إِ<نّ>َ, سَو<َا>ٓءٌ).
// Safari cannot place a mark that is in a different span from its letter, so it shows it apart.
// Move such marks across the tag so every mark sits with its own letter.
const TAG_MARKS = new RegExp('(<tajweed[^>]*>|</tajweed>)(' + ZWJ_MARK.source + '+)', 'g');
function marksWithLetter(html) {
  let prev;
  do { prev = html; html = html.replace(TAG_MARKS, '$2$1'); } while (html !== prev);
  return html;
}
function joinAcrossTags(html) {
  html = marksWithLetter(html);
  const out = [];
  let lastBase = null, pending = -1;                 // pending: where the tag(s) of a colour change start in `out`
  for (const part of html.split(/(<[^>]+>)/)) {
    if (!part) continue;
    if (part[0] === '<') { if (pending < 0) pending = out.length; out.push(part); continue; }
    for (const ch of part) {
      if (pending >= 0 && !ZWJ_MARK.test(ch)) {
        if (ZWJ_NEXT.test(ch) && lastBase && ZWJ_JOIN.includes(lastBase)) {
          out.splice(pending, 0, '‍');
          out.push('‍');
        }
      }
      pending = -1;
      out.push(ch);
      if (ch === ' ') lastBase = null; else if (!ZWJ_MARK.test(ch)) lastBase = ch;
    }
  }
  return out.join('');
}
function tajweed(p) {
  if (!tjCache[p]) {
    tjCache[p] = fetch('https://api.quran.com/api/v4/verses/by_page/' + p + '?words=true&per_page=50&word_fields=text_uthmani_tajweed,line_number')
      .then(r => r.json()).then(d => {
        const m = {};
        d.verses.forEach(v => v.words.forEach(w => {
          if (w.char_type_name !== 'word') return;          // we draw our own ayah number
          // Escape everything, then bring back ONLY plain <rule class=name> tags. Any other HTML stays harmless text.
          const html = esc(w.text_uthmani_tajweed)
            .replace(/&lt;rule class=(?:&quot;)?([a-z_-]+)(?:&quot;)?&gt;/g, '<tajweed class="$1">')
            .replace(/&lt;\/rule&gt;/g, '</tajweed>');
          const k = w.line_number + ':' + v.id;
          (m[k] = m[k] || []).push(html);           // one entry per word, in order
        }));
        return m;
      }).catch(e => { delete tjCache[p]; throw e; });
  }
  return tjCache[p];
}
// ---------- Page loading ----------
// Laptop / desktop (a wide screen held sideways): an open book with two pages, odd page on the right
// and even page on the left, as in the printed Mushaf. Phones show one page.
const isWide = () => innerWidth >= 900 && innerHeight >= 500 && innerWidth > innerHeight * 1.2;
const bookPages = () => [...$('book').children].filter(e => e.classList.contains('page'));
async function pageData(p, tjOn) {
  const [ayahs, lines, { surahs }] = await Promise.all([quran(p), layout(p), db()]);
  let tj = null;
  if (tjOn) { try { tj = await tajweed(p); } catch (e) { tj = null; } }
  return { p, ayahs, lines, surahs, tj };
}
async function loadPage(p, opts = {}) {
  p = Math.max(1, Math.min(604, p));
  const spread = isWide();
  if (spread && p % 2 === 0) p--;              // a spread always starts on its odd (right) page
  if (p === S.page && spread === S.spread && S.ayahs.length && !opts.noAnim && !opts.play) return;
  const dir = p >= S.page ? 'next' : 'prev';
  const id = ++S.loadId;          // newest request wins, so fast clicks never mix pages
  stopAudio();
  const nums = spread ? [p, p + 1] : [p];
  let data;
  try { data = await Promise.all(nums.map(n => pageData(n, document.body.classList.contains('tj')))); }
  catch (e) { if (id === S.loadId) $('book').innerHTML = '<div class="page"><div class="text"><div class="msg">⚠️ تعذّر التحميل. تحقق من الإنترنت.</div></div></div>'; return; }
  if (id !== S.loadId) return;

  // Page turns play even with "reduce motion" on: the reader picks the turn style (📖) in the menu.
  const animate = !opts.noAnim;
  // For the book page-turn: a copy of the two pages that are on screen now, taken before they change.
  const old = animate && spread && S.spread && S.turn === 'flip' ? bookPages().map(e => ({ el: e.cloneNode(true), r: e.getBoundingClientRect() })) : null;
  S.page = p; S.spread = spread; S.ayahs = data.flatMap(d => d.ayahs); S.sel = -1;
  const book = $('book');
  book.classList.toggle('spread', spread);
  let off = 0;
  book.innerHTML = data.map(d => { const h = pageHTML(d, off); off += d.ayahs.length; return h; }).join('');
  fitPage();
  // Scrolling back up lands at the bottom of the previous page (matters only when a page scrolls).
  $('reader').scrollTop = S.turn === 'scroll' && dir === 'prev' && !opts.noAnim ? 1e6 : 0;
  if (animate) {
    if (S.turn === 'flip' && spread) { if (old && old.length === 2) bookFlip(old, dir); }
    else if (S.turn === 'flip') {
      const box = book.querySelector('.text');
      void box.offsetWidth;                 // restart the animation
      box.classList.add('in-' + dir);
    } else {                                // the whole page slides in sideways, or from below / above
      book.classList.remove(...TURN_ANIMS);
      void book.offsetWidth;
      $('reader').classList.add('anim');    // no scrollbars while the page moves
      book.classList.add(S.turn + '-' + dir);
      clearTimeout(S.turnTimer);
      S.turnTimer = setTimeout(endTurnAnim, 600);   // in case the animation-end event never comes
    }
  }
  const first = S.ayahs[0];
  $('pg').value = p;
  $('lbl').textContent = `${first.surah.name} · الجزء ${ar(first.juz)} · صفحة ${ar(p)}${spread ? '–' + ar(p + 1) : ''}`;
  closeSheet();
  store.set('lastPage', p);
  if (opts.play) playFrom(0);
}
const go = d => loadPage(S.page + d * (S.spread ? 2 : 1));

// The open book turns like paper. Next: the left page lifts at the spine and turns over to the right,
// showing the new right page on its back while the new left page appears under it. Previous: the
// right page turns over to the left. Copies of the pages are animated above the real ones.
function bookFlip(old, dir) {
  const fx = $('flip'), now = bookPages().map(e => ({ el: e.cloneNode(true), r: e.getBoundingClientRect() }));
  const [stay, lift, under] = dir === 'next' ? [old[0], old[1], now[0]] : [old[1], old[0], now[1]];
  const box = (r, cls) => {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    return d;
  };
  const face = (pg, cls) => { const f = document.createElement('div'); f.className = 'face ' + cls; f.appendChild(pg); return f; };
  const still = box(stay.r); still.style.display = 'flex'; still.appendChild(stay.el);
  const leaf = box(lift.r, 'leaf ' + dir);
  leaf.append(face(lift.el, 'front'), face(under.el, 'back'));
  clearTimeout(S.flipTimer);
  fx.replaceChildren(still, leaf);
  const done = () => { clearTimeout(S.flipTimer); fx.replaceChildren(); };
  leaf.addEventListener('animationend', done, { once: true });
  S.flipTimer = setTimeout(done, 1200);          // in case the animation-end event never comes
}

// Draw one page line by line, exactly as the printed Mushaf. An ayah split over lines becomes
// several spans with the same data-i, so tapping, highlighting and audio treat them as one ayah.
// `off` is where this page's ayahs start in S.ayahs (the right page comes first in a spread).
function pageHTML({ p, ayahs, lines, surahs, tj }, off) {
  const base = ayahs[0].number;
  // In lines.json some ayah-number circles (566 of them) sit alone at the start of the next line,
  // which leaves a number and a wide gap at the start of a line. As in print, put the number at the end
  // of the line above, where its ayah ends. Line positions stay the same for the tajweed lookup.
  lines = lines.map(ln => Array.isArray(ln[0]) ? ln.map(s => s.slice()) : ln);
  lines.forEach((ln, L) => {
    if (!Array.isArray(ln[0]) || ln[0][1] !== '' || !ln[0][2] || !L) return;
    const prev = lines[L - 1], last = Array.isArray(prev[0]) && prev[prev.length - 1];
    if (last && last[0] === ln[0][0]) { last[2] = 1; ln.shift(); }
  });
  let h = '';
  lines.forEach((ln, L) => {
    if (ln[0] === 'h') { h += `<div class="line sura">${esc(surahs[ln[1] - 1].name)}</div>`; return; }
    if (ln[0] === 'b') { h += '<div class="line bism">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</div>'; return; }
    h += '<div class="line">' + ln.map(([g, words, end]) => {
      const i = g - base, a = ayahs[i];
      // Plain text, or the tajweed-tagged words of this same ayah on this same line when the switch is on.
      // Small pause marks (ۖ ۗ ۚ ۛ ...) come as separate words; join them to the word before, as in print.
      // In the Mushaf text the mark ۤ (U+06E4) makes the font draw the line ABOVE the word of
      // prostration. Tajweed colouring splits the letters so the font cannot draw it; there the
      // same words get a CSS overline instead (matched word by word with the Mushaf text).
      let tw = tj && tj[(L + 1) + ':' + g];
      // Quran.com sometimes breaks a line in a different place (e.g. Al-Anfal 6, As-Saffat 130), which
      // would drop or repeat a word. Use its tajweed only when it has exactly the Mushaf's letters.
      if (tw && bareLetters(tw.join(' ')) !== bareLetters(words)) tw = null;
      if (tw) {
        const qw = words.split(' ').reduce((acc, w) => {          // a lone mark (e.g. ۩) belongs to the word before
          if (acc.length && /^[ۖ-ۭ]+$/.test(w)) acc[acc.length - 1] += ' ' + w; else acc.push(w);
          return acc;
        }, []);
        tw = tw.map((w, j) => { w = joinAcrossTags(w); return qw[j] && qw[j].includes('ۤ') ? `<span class="ovl">${w}</span>` : w; }).join(' ');
      }
      const t = (tw || esc(words)).replace(/ ([ۖ-ۜ]+)(?= |$)/g, '$1');
      // Al-Fatihah: ayah 1 IS the Bismillah; it stays unnumbered and the numbering shifts by one.
      // In the Mushaf font, Arabic digits are drawn inside the ornate ayah circle.
      const num = end && shownNo(a) > 0 ? `<span class="num">${ar(shownNo(a))}</span>` : '';
      // The 15 sajdah (prostration) verses carry the ۩ sign in the Quran text.
      const sajda = a.text.includes('۩') ? ' sajda' : '';
      // The tajweed text leaves out the ۩ sign, so put it back at the end of a sajdah verse.
      const mark = sajda && end && !t.includes('۩') ? ' ۩' : '';
      return `<span class="ayah${sajda}" data-i="${off + i}">${t}${mark}${num}</span>`;
    }).join(' ') + '</div>';
  });
  // Page header and footer, as printed: surah of the page, juz in words, page number.
  const sura = 'سُورَةُ ' + ayahs[0].surah.name.replace(/^سُورَةُ\s*/, ''), juz = 'الجُزْءُ ' + JUZ[ayahs[0].juz - 1];
  return `<div class="page"><div class="phead"><span>${esc(sura)}</span><span>${esc(juz)}</span></div>` +
    `<div class="text${p <= 2 ? ' opening' : ''}">${h}</div><div class="pfoot"><span class="hPage">${ar(p)}</span></div></div>`;
}

// The whole page must fit on the screen, like a printed page: every line fits the width without
// wrapping (that would break the Mushaf layout) and all lines fit the height. Measure at the chosen
// font size and shrink the text only as much as needed.
// In the two-page book both pages get the same text size, as large as the screen allows: the
// whole spread fills the screen height. A+ / A− make it larger or smaller from there.
const BASE_FS = 1.9;
function fitPage() {
  const book = $('book'), reader = $('reader');
  const parts = bookPages().map(pg => ({ pg, box: pg.querySelector('.text'), ls: [...pg.querySelectorAll('.line')] }))
    .filter(x => x.box && x.ls.length);
  if (!parts.length) return;
  const spread = parts.length > 1;
  parts.forEach(x => x.ls.forEach(l => {
    l.style.fontSize = ''; l.style.lineHeight = '';
    if (l._kd) { l._kd.forEach(([n, d]) => { n.data = d; }); l._kd = null; }   // undo kashida
  }));
  const measure = x => {                        // natural (unstretched) width of every line
    x.box.classList.add('measure');
    const w = x.ls.map(l => l.offsetWidth);
    x.box.classList.remove('measure');
    return w;
  };
  parts.forEach(x => { x.box.style.fontSize = ''; x.pg.style.maxWidth = ''; });
  book.style.minHeight = '0';
  let widthSize = Infinity, frameW = 0;
  for (const x of parts) {
    const widths = measure(x), widest = Math.max(0, ...widths);
    // A line with only a few words (e.g. the end of An-Nas) would get huge gaps if stretched to the
    // full width; the printed Mushaf lengthens letters instead, which browsers cannot do. Centre it.
    x.ls.forEach((l, i) => l.classList.toggle('short', widths[i] < widest * 0.65));
    const room = x.box.clientWidth;
    if (!widest || room < 50) { book.style.minHeight = ''; return; }   // not laid out yet
    frameW = x.pg.offsetWidth - room;
    const k = room / widest * 0.98;                                   // fit the width
    widthSize = Math.min(widthSize, fs * (spread ? k : Math.min(1, k)));
  }
  let size = widthSize;
  const setSize = s => parts.forEach(x => { x.box.style.fontSize = s.toFixed(3) + 'rem'; });
  const tallest = () => parts.reduce((a, b) => (b.pg.offsetHeight > a.pg.offsetHeight ? b : a));
  setSize(size);
  // Fit the height too, so the whole page is on screen: only the text scales; header, footer and
  // frame stay the same size. On a very short screen (a phone held sideways) that would make the
  // text too small to read, so there the page keeps the width size and scrolls instead.
  const avail = reader.clientHeight - 8;
  if (avail > 200) {
    for (let n = 0; n < 3 && tallest().pg.offsetHeight > avail; n++) {
      const x = tallest(), textH = x.box.offsetHeight, fixedH = x.pg.offsetHeight - textH;
      size *= Math.max(0.3, (avail - fixedH) / textH) * 0.99;
      setSize(size);
    }
    if (spread) size = Math.min(widthSize, size * fs / BASE_FS);
    else if (size < widthSize * 0.6) size = widthSize;
    setSize(size);
  }
  book.style.minHeight = '';
  // On wide screens the page is only as wide as its longest line, like a printed page.
  // Measured again at the final size, so the frame can never be narrower than the text.
  // Both pages of a spread get the same width, so the spine stays in the middle.
  const w = Math.ceil(Math.max(...parts.map(x => Math.max(...measure(x)))) * 1.04 + frameW);
  parts.forEach(x => { if (w < x.pg.offsetWidth) x.pg.style.maxWidth = w + 'px'; });
  for (const x of parts) {
    // Close the gaps: a line a little shorter than the page would get all the extra room as wide
    // spaces between words and ayahs. Enlarge its words slightly instead (at most 15%), so the gaps
    // stay small; line-height is reduced by the same amount so the page height does not change.
    if (x.box.classList.contains('opening')) continue;
    const full = x.box.clientWidth * 0.995, nat = measure(x);
    x.ls.forEach((l, i) => {
      if (l.matches('.short,.sura,.bism') || !nat[i]) return;
      const k = Math.min(1.15, full / nat[i]);
      if (k > 1.005) { l.style.fontSize = k.toFixed(3) + 'em'; l.style.lineHeight = (2.05 / k).toFixed(3); }
    });
    // A line still clearly short gets the rest the way the printed Mushaf does it: kashida (ـ)
    // lengthens the joins between letters, one stretch near the end of each word.
    const after = measure(x);
    x.ls.forEach((l, i) => {
      if (l.matches('.short,.sura,.bism') || !after[i] || full - after[i] < full * 0.02) return;
      kashida(l, full - after[i]);
    });
  }
}
// Letters that join to the next letter, combining marks, and letters that can be joined to.
const KD_JOIN = 'بتثجحخسشصضطظعغفقكلمنهيئیـ', KD_MARK = /[ً-ٰٟۖ-ۭ]/,
      KD_NEXT = /[آ-يٱ-ۓ]/;
function kashida(line, room) {
  // Width of one kashida at this line's size.
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
  probe.textContent = 'ـــــــــــــــــــ';
  line.appendChild(probe);
  const kw = probe.offsetWidth / 10;
  probe.remove();
  if (!kw) return;
  // One place per word: the last join in it (never between lam and alef, which form one ligature).
  const spots = [];
  const walk = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) {
    if (n.parentNode.closest('.num')) continue;
    const s = n.data;
    let last = -1;
    for (let i = 0; i <= s.length; i++) {
      if (i === s.length || s[i] === ' ') {
        // Never stretch the name of Allah (its letters form one special ligature).
        const word = s.slice(s.lastIndexOf(' ', i - 1) + 1, i).replace(new RegExp(KD_MARK.source, 'g'), '');
        if (last >= 0 && !word.includes('لله')) spots.push([n, last]);
        last = -1; continue;
      }
      if (!KD_JOIN.includes(s[i])) continue;
      let j = i + 1;
      while (j < s.length && KD_MARK.test(s[j])) j++;
      if (j < s.length && KD_NEXT.test(s[j]) && !(s[i] === 'ل' && 'اأإآٱله'.includes(s[j]))) last = j;
    }
  }
  if (!spots.length) return;
  const box = line.parentNode, start = (box.classList.add('measure'), line.offsetWidth);
  box.classList.remove('measure');
  const limit = start + room;                  // the line may grow by `room`, never more
  // Insert from the end of each text node backwards so earlier positions stay valid; keep the
  // original text so a re-fit (rotating the phone) starts from clean text.
  const orig = new Map(spots.map(([n]) => [n, n.data]));
  let need = Math.floor(room * 0.9 / kw);
  for (let tries = 0; tries < 4 && need >= 1; tries++) {
    // Spread evenly over the words, at most 4 per word.
    const count = spots.map((_, i) => Math.min(4, Math.floor(need * (i + 1) / spots.length) - Math.floor(need * i / spots.length)));
    for (let i = spots.length - 1; i >= 0; i--) {
      const [n, at] = spots[i];
      if (count[i]) n.data = n.data.slice(0, at) + 'ـ'.repeat(count[i]) + n.data.slice(at);
    }
    box.classList.add('measure');
    const w = line.offsetWidth;
    box.classList.remove('measure');
    if (w <= limit) { line._kd = [...orig]; return; }
    orig.forEach((d, n) => { n.data = d; });  // a little too wide: undo and try with fewer
    need = Math.floor(need * 0.75);
  }
}
// Re-fit whenever the reading area really changes size (rotating the phone, browser bars showing or
// hiding). iPhone Safari reports the new size late after a rotation, so also re-fit a moment later.
let fitTimer;
// When the window becomes wide enough for the open book (or too narrow for it), redraw as one / two pages.
const refit = () => {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(() => { if (S.ayahs.length && isWide() !== !!S.spread) loadPage(S.page, { noAnim: true }); else fitPage(); }, 100);
};
addEventListener('resize', refit);
addEventListener('orientationchange', () => { refit(); setTimeout(fitPage, 500); setTimeout(fitPage, 1200); });
if (window.ResizeObserver) {
  let lastW = 0, lastH = 0;
  new ResizeObserver(([e]) => {
    const { width, height } = e.contentRect;
    if (Math.abs(width - lastW) > 1 || Math.abs(height - lastH) > 1) { lastW = width; lastH = height; refit(); }
  }).observe($('reader'));
}
if (document.fonts) document.fonts.ready.then(fitPage);

// ---------- Tap handling ----------
$('reader').addEventListener('click', e => {
  const a = e.target.closest('.ayah');
  closeList();
  if (a) return selectAyah(+a.dataset.i);
  if ($('sheet').classList.contains('open')) return closeSheet();
  document.body.classList.toggle('menu');
});

function selectAyah(i) {
  S.sel = i;
  $('book').querySelectorAll('.ayah.sel').forEach(e => e.classList.remove('sel'));
  $('book').querySelectorAll(`.ayah[data-i="${i}"]`).forEach(e => e.classList.add('sel'));
  const a = S.ayahs[i];
  $('ref').textContent = a.surah.number === 1 && a.numberInSurah === 1 ? `${a.surah.name} · البسملة` : `${a.surah.name} ﴿${ar(shownNo(a))}﴾`;
  $('sheet').classList.add('open');
  $('ans').textContent = ''; $('aq').value = '';
  fill(i);
}
function closeSheet() {
  $('sheet').classList.remove('open');
  $('book').querySelectorAll('.ayah.sel').forEach(e => e.classList.remove('sel'));
  S.sel = -1;
}
async function fill(i) {
  const p = S.page, ed = $('trSel').value;
  $('tr').textContent = ed === 'none' ? '' : '…';
  $('tr').dir = ed === 'ur.jalandhry' ? 'rtl' : 'ltr';
  $('tf').textContent = '…';
  const a = S.ayahs[i];                       // by global ayah number, so it works on either page of a spread
  const put = async (el, ed) => {
    try { const list = await edition(ed); if (S.page === p && S.sel === i) el.textContent = list[a.number - 1]; }
    catch (e) { if (S.page === p && S.sel === i) el.textContent = '—'; }
  };
  if (ed !== 'none') put($('tr'), ed);
  put($('tf'), 'ar.muyassar');
}

// ---------- Audio (one file per ayah, by its global ayah number) ----------
// Ayah repetition: each ayah is recited S.rep times in a row before moving on (1 = normal reading).
// After the last repetition it goes on to the next ayah, or stops if "auto next" is switched off.
S.rep = Math.max(1, Math.min(999, parseInt(store.get('rep')) || 1));
S.autoNext = store.get('repNext') !== '0';
S.playing = null;                         // { i, n }: ayah index on this page and which repetition
function stopAudio() {
  const a = S.audio; S.audio = null;
  if (a) { a.onended = a.onerror = null; a.pause(); a.removeAttribute('src'); a.load(); }
  $('play').textContent = '▶';
  $('book').querySelectorAll('.ayah.cur').forEach(e => e.classList.remove('cur'));
  S.playing = null;
  showRep();
}
function playFrom(i, n = 1) {
  stopAudio();
  if (i >= S.ayahs.length) { const nx = S.page + (S.spread ? 2 : 1); if (nx <= 604) loadPage(nx, { play: true }); return; }
  const a = S.ayahs[i];
  const opt = $('rec').options[$('rec').selectedIndex];
  // Most reciters come from islamic.network (by global ayah number). Reciters marked data-ea
  // come from everyayah.com, where files are named by surah + ayah, e.g. 002255.mp3.
  const pad = n => String(n).padStart(3, '0');
  const url = opt.dataset.ea
    ? `https://everyayah.com/data/${opt.dataset.ea}/${pad(a.surah.number)}${pad(a.numberInSurah)}.mp3`
    : `https://cdn.islamic.network/quran/audio/${opt.dataset.br || '128'}/${opt.value}/${a.number}.mp3`;
  const au = new Audio(url);
  S.audio = au;
  $('play').textContent = '⏸';
  const parts = $('book').querySelectorAll(`.ayah[data-i="${i}"]`);
  parts.forEach(e => e.classList.add('cur'));
  if (parts[0]) parts[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
  // Stop instead of silently skipping to the wrong ayah. Recitation is streamed, so say so when offline.
  const fail = () => { stopAudio(); if (!navigator.onLine) showVoice('', 'التلاوة الصوتية تحتاج إلى الإنترنت. القراءة تعمل بدونه.', true); };
  S.playing = { i, n };
  showRep();
  au.onended = () => {
    if (S.audio !== au) return;
    if (S.playing.n < S.rep) {               // same ayah again, from the start of the same audio file
      S.playing.n++;
      showRep();
      au.currentTime = 0;
      au.play().catch(() => { if (S.audio === au) fail(); });
      return;
    }
    if (S.rep > 1 && !S.autoNext) { stopAudio(); return; }
    playFrom(i + 1);
  };
  au.onerror = fail;
  au.play().catch(e => { if (S.audio === au) fail(); });
}

// ---------- Ayah repetition menu ----------
function showRep() {
  const btn = $('repBtn');
  btn.innerHTML = '🔁' + (S.rep > 1 ? `<b class="badge">${ar(S.rep)}</b>` : '');
  btn.classList.toggle('on', S.rep > 1);
  document.querySelectorAll('#repPresets button').forEach(b => b.classList.toggle('on', +b.dataset.n === S.rep));
  if (document.activeElement !== $('repN')) $('repN').value = S.rep;
  $('repNext').checked = S.autoNext;
  const p = S.playing, a = p && S.ayahs[p.i];
  $('repStat').textContent = !a ? (S.rep > 1 ? `كل آية ستُكرَّر ${ar(S.rep)} مرة.` : 'بدون تكرار (قراءة عادية).')
    : `${a.surah.name} ﴿${ar(shownNo(a))}﴾ — التكرار ${ar(p.n)} من ${ar(S.rep)}`;
}
function setRep(n) {
  S.rep = Math.max(1, Math.min(999, parseInt(n) || 1));
  store.set('rep', S.rep);
  if (S.playing && S.playing.n > S.rep) S.playing.n = S.rep;   // lowering it mid-ayah finishes this ayah
  showRep();
}
$('repBtn').onclick = e => {
  e.stopPropagation();
  const open = !$('repPanel').classList.contains('show');
  $('repPanel').classList.toggle('show', open);
  $('repBtn').setAttribute('aria-expanded', open);
  showRep();
};
$('repX').onclick = () => { $('repPanel').classList.remove('show'); $('repBtn').setAttribute('aria-expanded', false); };
$('repPresets').onclick = e => { const b = e.target.closest('button'); if (b) setRep(b.dataset.n); };
$('repN').onchange = () => setRep($('repN').value);
$('repNext').onchange = () => { S.autoNext = $('repNext').checked; store.set('repNext', S.autoNext ? '1' : '0'); };
// Start from the ayah being recited, else the tapped ayah, else the first ayah of the page.
$('repPlay').onclick = () => {
  const i = S.playing ? S.playing.i : (S.sel >= 0 ? S.sel : 0);
  if (S.rep === 1) setRep(parseInt($('repN').value) > 1 ? $('repN').value : 20);
  playFrom(i);
};
$('repStop').onclick = stopAudio;
function togglePlay() {
  const a = S.audio;
  if (a) {
    if (a.paused) { a.play(); $('play').textContent = '⏸'; }
    else { a.pause(); $('play').textContent = '▶'; }
    return;
  }
  playFrom(S.sel >= 0 ? S.sel : 0);
}
$('play').onclick = togglePlay;
$('stop').onclick = stopAudio;
$('sp').onclick = () => { const i = S.sel; closeSheet(); playFrom(i); };
$('sx').onclick = closeSheet;

// ---------- Navigation ----------
$('next').onclick = () => go(1);
$('prev').onclick = () => go(-1);
$('pg').onchange = () => loadPage(parseInt($('pg').value) || S.page);
// Three ways to turn pages (menu setting): flip (page turns), slide (sideways), scroll (up / down).
const TURNS = ['flip', 'slide', 'scroll'], TURN_ANIMS = ['slide-next', 'slide-prev', 'scroll-next', 'scroll-prev'];
function setTurn(t) {
  S.turn = TURNS.includes(t) ? t : 'flip';
  $('turnSel').value = S.turn;
  $('turnBtn').textContent = TURN_ICONS[S.turn];
  $('turnBtn').title = 'تقليب الصفحات: ' + TURN_NAMES[S.turn];
  store.set('turn', S.turn);
}
const TURN_ICONS = { flip: '📖', slide: '↔', scroll: '↕' },
      TURN_NAMES = { flip: 'قلب الصفحة', slide: 'سحب يمين / يسار', scroll: 'تمرير لأسفل' };
$('turnSel').onchange = () => setTurn($('turnSel').value);
// Top-bar button: each tap moves to the next way, and says which one is now on.
let turnMsgTimer;
$('turnBtn').onclick = () => {
  setTurn(TURNS[(TURNS.indexOf(S.turn) + 1) % TURNS.length]);
  const lbl = $('lbl'), old = lbl.dataset.old ?? lbl.textContent;
  lbl.dataset.old = old;
  const msg = lbl.textContent = TURN_ICONS[S.turn] + ' ' + TURN_NAMES[S.turn];
  clearTimeout(turnMsgTimer);
  turnMsgTimer = setTimeout(() => {          // put the page name back, unless a new page already did
    if (lbl.textContent === msg) lbl.textContent = lbl.dataset.old;
    delete lbl.dataset.old;
  }, 1500);
};
function endTurnAnim() {
  $('book').classList.remove(...TURN_ANIMS);
  $('reader').classList.remove('anim');
}
$('book').addEventListener('animationend', e => { if (e.target === $('book')) endTurnAnim(); });
// In scroll mode a page that is taller than the screen first scrolls normally; the page turns only
// when it is already at its bottom (next) or top (previous).
const atBottom = () => { const r = $('reader'); return r.scrollTop + r.clientHeight >= r.scrollHeight - 2; };
const atTop = () => $('reader').scrollTop <= 1;
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === 'ArrowLeft') go(1);
  if (e.key === 'ArrowRight') go(-1);
  if (S.turn === 'scroll') {
    if ((e.key === 'ArrowDown' || e.key === 'PageDown') && atBottom()) go(1);
    if ((e.key === 'ArrowUp' || e.key === 'PageUp') && atTop()) go(-1);
  }
});
let tx = 0, ty = 0, startBottom = false, startTop = false;   // swipe right = next page (Arabic reads right to left)
$('reader').addEventListener('touchstart', e => {
  tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  startBottom = atBottom(); startTop = atTop();
}, { passive: true });
$('reader').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
  if (S.turn === 'scroll') {                // finger up = next page, finger down = previous page
    if (Math.abs(dy) > 70 && Math.abs(dy) > 2 * Math.abs(dx)) {
      if (dy < 0 && startBottom) go(1);
      else if (dy > 0 && startTop) go(-1);
    }
    return;
  }
  if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) go(dx > 0 ? 1 : -1);
}, { passive: true });
// Mouse wheel / touchpad on a laptop, scroll mode only. A short pause after each turn so one
// flick of the wheel turns one page, not several.
let wheelSum = 0, wheelLock = 0;
$('reader').addEventListener('wheel', e => {
  if (S.turn !== 'scroll') return;
  if (Date.now() < wheelLock) { wheelSum = 0; return; }
  if ((e.deltaY > 0 && atBottom()) || (e.deltaY < 0 && atTop())) {
    wheelSum += e.deltaY;
    if (Math.abs(wheelSum) > 120) { wheelLock = Date.now() + 900; go(wheelSum > 0 ? 1 : -1); wheelSum = 0; }
  } else wheelSum = 0;
}, { passive: true });

// ---------- Surah list ----------
function renderList() {
  const q = $('q').value.trim().toLowerCase();
  $('list').innerHTML = S.surahs.filter(s =>
    s.name.includes(q) || s.englishName.toLowerCase().includes(q) || String(s.number) === q
  ).map(s => `<li data-n="${esc(s.number)}"><span>${esc(ar(s.number))}</span><span>${esc(s.name)}<br><small>${esc(s.englishName)} · ${esc(ar(s.numberOfAyahs))}</small></span></li>`).join('');
}
async function openList() {
  $('drawer').classList.add('open');
  if (!S.surahs) {
    try { S.surahs = (await db()).surahs; renderList(); }
    catch (e) { $('list').innerHTML = '<li>⚠️ تعذّر التحميل</li>'; }
  }
}
function closeList() { $('drawer').classList.remove('open'); }
$('openList').onclick = openList;
$('closeList').onclick = closeList;
$('q').oninput = () => S.surahs && renderList();
$('list').onclick = async e => {
  const li = e.target.closest('li'); if (!li) return;
  closeList();
  try { loadPage(await surahPage(+li.dataset.n)); } catch (err) {}
};
$('trSel').onchange = () => { store.set('tr', $('trSel').value); if (S.sel >= 0) fill(S.sel); };
$('rec').onchange = () => { store.set('rec', $('rec').value); };

// ---------- Tajweed switch ----------
function setTajweed(on) {
  document.body.classList.toggle('tj', on);
  $('tjBtn').textContent = 'التجويد: ' + (on ? 'تشغيل' : 'إيقاف');
  $('tjBtn').setAttribute('aria-pressed', on);
  $('lgBtn').style.display = on ? '' : 'none';
  $('legend').classList.toggle('show', on && $('legend').dataset.open === '1');
  store.set('tj', on ? '1' : '0');
}
$('tjBtn').onclick = () => {
  const on = !document.body.classList.contains('tj');
  setTajweed(on);
  loadPage(S.page, { noAnim: true });     // reload same page with / without tajweed text
};
$('lgBtn').onclick = () => {
  const l = $('legend');
  l.dataset.open = l.dataset.open === '1' ? '0' : '1';
  l.classList.toggle('show', l.dataset.open === '1');
};

// ---------- Theme & font ----------
const themes = ['light', 'dark', 'night'];
function setTheme(t) {
  const keep = ['menu', 'tj'].filter(c => document.body.classList.contains(c));
  document.body.className = [t, ...keep].join(' ');
  store.set('theme', t);
}
$('theme').onclick = () => {
  const cur = themes.find(t => document.body.classList.contains(t)) || 'light';
  setTheme(themes[(themes.indexOf(cur) + 1) % 3]);
};
let fs = parseFloat(store.get('fs')) || 1.9;
function setFont(v) {
  fs = Math.max(1.2, Math.min(3.5, +v.toFixed(1)));
  document.documentElement.style.setProperty('--fs', fs + 'rem');
  store.set('fs', fs);
  fitPage();
}
$('fMinus').onclick = () => setFont(fs - 0.1);
$('fPlus').onclick = () => setFont(fs + 0.1);

// ---------- Keep the screen on while reading ----------
// The phone would turn its screen off after a short time without touches, in the middle of reading.
// The Screen Wake Lock asks it to stay on while the app is open. The phone drops the lock whenever the
// app is hidden, so take it again when the app comes back, and on the next touch if it was refused.
S.awake = store.get('awake') !== '0';
let wakeLock = null, wakeAsking = false;
async function keepAwake() {
  if (!S.awake || wakeLock || wakeAsking || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  wakeAsking = true;
  try {
    const l = await navigator.wakeLock.request('screen');
    l.addEventListener('release', () => { if (wakeLock === l) wakeLock = null; });
    if (S.awake) wakeLock = l; else l.release();
  } catch (e) {}
  wakeAsking = false;
}
function setAwake(on) {
  S.awake = on;
  store.set('awake', on ? '1' : '0');
  $('awakeBtn').textContent = '☀ إبقاء الشاشة مضاءة: ' + (on ? 'تشغيل' : 'إيقاف');
  $('awakeBtn').setAttribute('aria-pressed', on);
  if (on) keepAwake();
  else if (wakeLock) { const l = wakeLock; wakeLock = null; l.release().catch(() => {}); }
}
$('awakeBtn').onclick = () => setAwake(!S.awake);
document.addEventListener('visibilitychange', keepAwake);
['click', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, keepAwake, { passive: true }));

// ---------- Start ----------
setAwake(S.awake);
setTheme(store.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
setFont(fs);
if (store.get('tr')) $('trSel').value = store.get('tr');
if (store.get('rec')) $('rec').value = store.get('rec');
if (!$('rec').value) $('rec').selectedIndex = 0;
setTajweed(store.get('tj') === '1');
setTurn(store.get('turn'));
loadPage(parseInt(store.get('lastPage')) || 1, { noAnim: true });

// ---------- Ask the assistant (typed box + voice share one endpoint) ----------
async function askServer(q, useAyah) {
  const body = { question: q, state: { page: S.page, surah: S.ayahs[0] ? S.ayahs[0].surah.number : null } };
  if (useAyah && S.sel >= 0) { const a = S.ayahs[S.sel]; body.surah = a.surah.number; body.ayah = a.numberInSurah; }
  let r, d;
  try {
    r = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    d = await r.json();
  } catch (e) { throw new Error('تعذّر الاتصال. تحقق من الإنترنت.'); }
  if (!r.ok) throw new Error(d.error || 'حدث خطأ.');
  return d;
}

// The server only ever sends an action from a fixed, validated list. Anything else is ignored here too.
async function runAction(d) {
  const say = d.answer || '';
  switch (d.action) {
    case 'goto_surah': await loadPage(await surahPage(+d.value)); break;
    case 'goto_page': await loadPage(d.value); break;
    case 'next_page': await go(1); break;
    case 'prev_page': await go(-1); break;
    case 'tajweed': setTajweed(!!d.value); await loadPage(S.page, { noAnim: true }); break;
    case 'reciter': $('rec').value = d.value; store.set('rec', d.value); break;
    case 'translation': $('trSel').value = d.value; store.set('tr', d.value); if (S.sel >= 0) fill(S.sel); break;
    case 'theme': setTheme(d.value); break;
    case 'font': setFont(fs + (d.value === 'up' ? 0.2 : -0.2)); break;
    case 'play': if (S.audio && S.audio.paused) togglePlay(); else if (!S.audio) playFrom(S.sel >= 0 ? S.sel : 0); break;
    case 'stop': stopAudio(); break;
    default: break;            // "answer": nothing to do on the page
  }
  return say || 'تم.';
}

async function askAI() {
  const i = S.sel; if (i < 0) return;
  const q = $('aq').value.trim(); if (!q) return;
  $('ab').disabled = true; $('ans').className = ''; $('ans').textContent = '…';
  try {
    const d = await askServer(q, true);
    const msg = await runAction(d);
    if (S.sel === i) $('ans').textContent = msg;
  } catch (e) {
    if (S.sel === i) { $('ans').className = 'err'; $('ans').textContent = e.message || 'حدث خطأ.'; }
  }
  $('ab').disabled = false;
}
$('ab').onclick = askAI;
$('aq').addEventListener('keydown', e => { if (e.key === 'Enter') askAI(); });

// ---------- Voice assistant ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let vlang = store.get('vlang') === 'en-US' ? 'en-US' : 'ar-SA';
let recog = null, listening = false;
const setMic = on => document.querySelectorAll('.mic').forEach(b => b.classList.toggle('on', on));
function showVoice(you, bot, isErr) {
  $('vyou').textContent = you || '';
  $('vbot').textContent = bot || '';
  $('vp').classList.toggle('err', !!isErr);
  $('vp').classList.add('show');
}
function speak(t) {
  if (!('speechSynthesis' in window) || !t) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t);
  u.lang = /[\u0600-\u06FF]/.test(t) ? 'ar-SA' : 'en-US';
  speechSynthesis.speak(u);
}
async function handleVoice(text) {
  showVoice(text, '…');
  try {
    const d = await askServer(text, S.sel >= 0);
    const msg = await runAction(d);
    showVoice(text, msg); speak(msg);
  } catch (e) { showVoice(text, e.message || 'تعذّر الاتصال.', true); }
}
function startVoice() {
  if (!SR) return showVoice('', 'المتصفح لا يدعم الأوامر الصوتية. جرّب Chrome أو Edge.', true);
  if (listening) { try { recog.stop(); } catch (e) {} return; }
  if (S.audio && !S.audio.paused) { S.audio.pause(); $('play').textContent = '▶'; }   // so the recitation is not heard as speech
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  recog = new SR();
  recog.lang = vlang; recog.interimResults = true; recog.continuous = false; recog.maxAlternatives = 1;
  let heard = '';
  recog.onstart = () => { listening = true; setMic(true); showVoice('', vlang === 'ar-SA' ? 'أستمع إليك…' : 'Listening…'); };
  recog.onresult = e => { heard = Array.from(e.results).map(r => r[0].transcript).join(' ').trim(); $('vyou').textContent = heard; };
  recog.onerror = e => {
    heard = '';
    const msg = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'اسمح للمتصفح باستخدام الميكروفون.'
      : e.error === 'no-speech' ? 'لم أسمع شيئًا. حاول مرة أخرى.' : 'تعذّر الاستماع. حاول مرة أخرى.';
    showVoice('', msg, true);
  };
  recog.onend = () => { listening = false; setMic(false); if (heard) handleVoice(heard); };
  try { recog.start(); } catch (e) { showVoice('', 'تعذّر تشغيل الميكروفون.', true); }
}
document.querySelectorAll('.mic').forEach(b => b.onclick = e => { e.stopPropagation(); startVoice(); });
$('vl').textContent = vlang === 'ar-SA' ? 'ع' : 'EN';
$('vl').onclick = () => { vlang = vlang === 'ar-SA' ? 'en-US' : 'ar-SA'; store.set('vlang', vlang); $('vl').textContent = vlang === 'ar-SA' ? 'ع' : 'EN'; };
$('vx').onclick = () => {
  $('vp').classList.remove('show');
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (listening) { try { recog.stop(); } catch (e) {} }
};

// ---------- Offline / install ----------
if ('serviceWorker' in navigator) {
  // An iPhone home-screen app is usually resumed from memory, not reloaded, so it would keep
  // showing the old version. Look for a new version every time the app comes back on screen,
  // and reload once when it is installed (not while a recitation is playing).
  const hadWorker = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadWorker || reloading || (S.audio && !S.audio.paused)) return;
    reloading = true;
    location.reload();
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }));
}
// Keep the chosen translation on the phone too (the Quran text and tafsir are saved when the app installs).
$('trSel').addEventListener('change', () => edition($('trSel').value).catch(() => {}));
if ($('trSel').value !== 'none') edition($('trSel').value).catch(() => {});
