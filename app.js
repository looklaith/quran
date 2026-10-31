const $ = id => document.getElementById(id);
const S = { page: 1, ayahs: [], sel: -1, loadId: 0, audio: null, surahs: null };
const cache = {};
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }
};
// Number shown on screen: in Al-Fatihah the Bismillah is an unnumbered heading, so verses shift down by one.
const shownNo = a => a.surah.number === 1 ? a.numberInSurah - 1 : a.numberInSurah;
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
const surahPage = n => db().then(d => { const p = d.firstPage[n]; if (!p) throw new Error('bad'); return p; });
function edition(ed) {
  if (!EDITIONS.includes(ed)) return Promise.reject(new Error('bad'));
  if (!cache[ed]) cache[ed] = json('/data/' + ed + '.json').catch(e => { delete cache[ed]; throw e; });
  return cache[ed];
}
// Tajweed text comes from Quran.com (HTML tags per rule). Keyed by page + ayah number in surah.
const tjCache = {};
function tajweed(p) {
  if (!tjCache[p]) {
    tjCache[p] = fetch('https://api.quran.com/api/v4/verses/by_page/' + p + '?words=false&per_page=300&fields=text_uthmani_tajweed')
      .then(r => r.json()).then(d => {
        const m = {};
        d.verses.forEach(v => {
          // Drop the end-of-ayah span (we draw our own number), escape everything,
          // then bring back ONLY plain <tajweed class=name> tags. Any other HTML stays harmless text.
          const raw = String(v.text_uthmani_tajweed || '').replace(/<span class=end>.*?<\/span>/g, '');
          m[v.verse_key] = esc(raw)
            .replace(/&lt;tajweed class=(?:&quot;)?([a-z_]+)(?:&quot;)?&gt;/g, '<tajweed class="$1">')
            .replace(/&lt;\/tajweed&gt;/g, '</tajweed>')
            .trim();
        });
        return m;
      }).catch(e => { delete tjCache[p]; throw e; });
  }
  return tjCache[p];
}
// Translation / tafsir rows for one page, in the same order as the page's ayahs.
const extra = async (p, ed) => {
  const [list, page] = await Promise.all([edition(ed), quran(p)]);
  return page.map(a => ({ text: list[a.number - 1] }));
};

// ---------- Page loading ----------
async function loadPage(p, opts = {}) {
  p = Math.max(1, Math.min(604, p));
  const dir = p >= S.page ? 'next' : 'prev';
  const id = ++S.loadId;          // newest request wins, so fast clicks never mix pages
  stopAudio();
  let ayahs, tj = null;
  try {
    ayahs = await quran(p);
    if (document.body.classList.contains('tj')) { try { tj = await tajweed(p); } catch (e) { tj = null; } }
  }
  catch (e) { if (id === S.loadId) $('text').innerHTML = '<div class="msg">⚠️ تعذّر التحميل. تحقق من الإنترنت.</div>'; return; }
  if (id !== S.loadId) return;

  S.page = p; S.ayahs = ayahs; S.sel = -1;
  let h = '';
  ayahs.forEach((a, i) => {
    const n = a.surah.number;
    const first = a.numberInSurah === 1;
    // Plain text, or the tajweed-tagged text for this same ayah when the switch is on.
    let t = (tj && tj[n + ':' + a.numberInSurah]) || esc(a.text);
    // Al-Fatihah: ayah 1 IS the Bismillah. Show it only as the (unnumbered) heading.
    // It keeps data-i so audio, highlighting and tap still work; numbering below shifts by one.
    if (n === 1 && a.numberInSurah === 1) {
      h += `<span class="sura">${esc(a.surah.name)}</span>`;
      h += `<span class="bism ayah" data-i="${i}">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</span>`;
      return;
    }
    if (first) {
      h += `<span class="sura">${esc(a.surah.name)}</span>`;
      // The Bismillah is ALWAYS shown as a heading, in the same place for every surah
      // (including Al-Fatihah), except At-Tawbah (surah 9) which has none.
      if (n !== 9) h += `<span class="bism">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</span>`;
      // Remove the Bismillah from the start of ayah 1 so it is not shown twice.
      // Works for plain text and for tajweed text (words may be wrapped in tags).
      if (n !== 9) {
        const words = t.split(/ (?![^<]*>)/);          // split on spaces that are not inside a tag
        const clean = w => w.replace(/<[^>]*>/g, '')
          .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
          .replace(/[\u0671\u0622\u0623\u0625]/g, '\u0627');
        if (words.length > 4 && clean(words[0]) === '\u0628\u0633\u0645' && clean(words[1]) === '\u0627\u0644\u0644\u0647') {
          t = words.slice(4).join(' ');
        }
      }
    }
    // The 15 sajdah (prostration) verses carry the ۩ sign in the Quran text; underline them.
    const sajda = a.text.includes('۩') ? ' sajda' : '';
    h += `<span class="ayah${sajda}" data-i="${i}">${t}<span class="num">﴿${ar(shownNo(a))}﴾</span></span> `;
  });
  const box = $('text');
  box.className = '';
  box.innerHTML = h;
  $('reader').scrollTop = 0;
  if (!opts.noAnim && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
    void box.offsetWidth;                 // restart the animation
    box.className = 'in-' + dir;
  }
  $('pg').value = p;
  $('lbl').textContent = `${ayahs[0].surah.name} · الجزء ${ar(ayahs[0].juz)} · صفحة ${ar(p)}`;
  closeSheet();
  store.set('lastPage', p);
  if (opts.play) playFrom(0);
}
const go = d => loadPage(S.page + d);

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
  document.querySelectorAll('.ayah.sel').forEach(e => e.classList.remove('sel'));
  document.querySelector(`.ayah[data-i="${i}"]`).classList.add('sel');
  const a = S.ayahs[i];
  $('ref').textContent = a.surah.number === 1 && a.numberInSurah === 1 ? `${a.surah.name} · البسملة` : `${a.surah.name} ﴿${ar(shownNo(a))}﴾`;
  $('sheet').classList.add('open');
  $('ans').textContent = ''; $('aq').value = '';
  fill(i);
}
function closeSheet() {
  $('sheet').classList.remove('open');
  document.querySelectorAll('.ayah.sel').forEach(e => e.classList.remove('sel'));
  S.sel = -1;
}
async function fill(i) {
  const p = S.page, ed = $('trSel').value;
  $('tr').textContent = ed === 'none' ? '' : '…';
  $('tr').dir = ed === 'ur.jalandhry' ? 'rtl' : 'ltr';
  $('tf').textContent = '…';
  const put = async (el, edition) => {
    try { const x = await extra(p, edition); if (S.page === p && S.sel === i) el.textContent = x[i].text; }
    catch (e) { if (S.page === p && S.sel === i) el.textContent = '—'; }
  };
  if (ed !== 'none') put($('tr'), ed);
  put($('tf'), 'ar.muyassar');
}

// ---------- Audio (one file per ayah, by its global ayah number) ----------
function stopAudio() {
  const a = S.audio; S.audio = null;
  if (a) { a.onended = a.onerror = null; a.pause(); a.removeAttribute('src'); a.load(); }
  $('play').textContent = '▶';
  document.querySelectorAll('.ayah.cur').forEach(e => e.classList.remove('cur'));
}
function playFrom(i) {
  stopAudio();
  if (i >= S.ayahs.length) { if (S.page < 604) loadPage(S.page + 1, { play: true }); return; }
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
  const el = document.querySelector(`.ayah[data-i="${i}"]`);
  el.classList.add('cur');
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  au.onended = () => playFrom(i + 1);
  // Stop instead of silently skipping to the wrong ayah. Recitation is streamed, so say so when offline.
  const fail = () => { stopAudio(); if (!navigator.onLine) showVoice('', 'التلاوة الصوتية تحتاج إلى الإنترنت. القراءة تعمل بدونه.', true); };
  au.onerror = fail;
  au.play().catch(e => { if (S.audio === au) fail(); });
}
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
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowLeft') go(1);
  if (e.key === 'ArrowRight') go(-1);
});
let tx = 0, ty = 0;   // swipe right = next page (Arabic reads right to left)
$('reader').addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
$('reader').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) go(dx > 0 ? 1 : -1);
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
}
$('fMinus').onclick = () => setFont(fs - 0.1);
$('fPlus').onclick = () => setFont(fs + 0.1);

// ---------- Start ----------
setTheme(store.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
setFont(fs);
if (store.get('tr')) $('trSel').value = store.get('tr');
if (store.get('rec')) $('rec').value = store.get('rec');
if (!$('rec').value) $('rec').selectedIndex = 0;
setTajweed(store.get('tj') === '1');
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
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
// Keep the chosen translation on the phone too (the Quran text and tafsir are saved when the app installs).
$('trSel').addEventListener('change', () => edition($('trSel').value).catch(() => {}));
if ($('trSel').value !== 'none') edition($('trSel').value).catch(() => {});
