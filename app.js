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

// ---------- App language ----------
// The language picked in the translation list (☰ → 📜) is also the language of every button, caption and
// message. "العربية (بدون ترجمة)" = Arabic. The Mushaf pages themselves always stay Arabic.
// Each entry: [Arabic, English, Français, اردو, Türkçe]. A function entry gets extra values (numbers, names).
const LANGS = ['ar', 'en', 'fr', 'ur', 'tr'];
const LANG_OF = { 'en.sahih': 'en', 'fr.hamidullah': 'fr', 'ur.jalandhry': 'ur', 'tr.diyanet': 'tr', none: 'ar' };
let L = 'ar';
const I18N = {
  title: ['مصحفي', 'Mushafi', 'Mushafi', 'مصحفی', 'Mushafi'],
  menu: ['القائمة', 'Menu', 'Menu', 'مینو', 'Menü'],
  bigger: ['تكبير الخط', 'Larger text', 'Agrandir le texte', 'متن بڑا کریں', 'Yazıyı büyüt'],
  smaller: ['تصغير الخط', 'Smaller text', 'Réduire le texte', 'متن چھوٹا کریں', 'Yazıyı küçült'],
  prevT: ['الصفحة السابقة', 'Previous page', 'Page précédente', 'پچھلا صفحہ', 'Önceki sayfa'],
  prev: ['السابقة', 'Previous', 'Précédente', 'پچھلا', 'Önceki'],
  pageNo: ['رقم الصفحة', 'Page number', 'Numéro de page', 'صفحہ نمبر', 'Sayfa numarası'],
  page: ['الصفحة', 'Page', 'Page', 'صفحہ', 'Sayfa'],
  nextT: ['الصفحة التالية', 'Next page', 'Page suivante', 'اگلا صفحہ', 'Sonraki sayfa'],
  next: ['التالية', 'Next', 'Suivante', 'اگلا', 'Sonraki'],
  play: ['تشغيل', 'Play', 'Lecture', 'چلائیں', 'Oynat'],
  stop: ['إيقاف', 'Stop', 'Arrêt', 'روکیں', 'Durdur'],
  repT: ['تكرار الآيات', 'Repeat ayahs', 'Répéter les versets', 'آیات دہرائیں', 'Ayetleri tekrarla'],
  rep: ['تكرار', 'Repeat', 'Répéter', 'دہرائیں', 'Tekrar'],
  speak: ['تحدث', 'Speak', 'Parler', 'بولیں', 'Konuş'],
  surahs: ['السور', 'Surahs', 'Sourates', 'سورتیں', 'Sureler'],
  turnT: ['طريقة تقليب الصفحات', 'Page turn style', 'Façon de tourner les pages', 'صفحہ پلٹنے کا انداز', 'Sayfa çevirme şekli'],
  turn: ['التقليب', 'Turning', 'Tourner', 'پلٹنا', 'Çevirme'],
  colors: ['الألوان', 'Colours', 'Couleurs', 'رنگ', 'Renkler'],
  vlT: ['لغة الصوت', 'Voice language', 'Langue de la voix', 'آواز کی زبان', 'Ses dili'],
  vl: ['اللغة', 'Voice', 'Voix', 'آواز', 'Ses'],
  fs: ['ملء الشاشة', 'Full screen', 'Plein écran', 'پوری اسکرین', 'Tam ekran'],
  fsExit: ['خروج من ملء الشاشة', 'Exit full screen', 'Quitter le plein écran', 'پوری اسکرین بند کریں', 'Tam ekrandan çık'],
  listen: ['▶ استمع من هنا', '▶ Listen from here', '▶ Écouter d’ici', '▶ یہاں سے سنیں', '▶ Buradan dinle'],
  close: ['إغلاق', 'Close', 'Fermer', 'بند کریں', 'Kapat'],
  closeX: ['✕ إغلاق', '✕ Close', '✕ Fermer', '✕ بند کریں', '✕ Kapat'],
  tafsir: ['التفسير الميسر', 'Tafsir Al-Muyassar (Arabic)', 'Tafsir Al-Muyassar (en arabe)', 'تفسیر میسر (عربی)', 'El-Müyesser tefsiri (Arapça)'],
  askL: ['اسأل عن هذه الآية', 'Ask about this ayah', 'Une question sur ce verset', 'اس آیت کے بارے میں پوچھیں', 'Bu ayet hakkında sor'],
  askPh: ['اكتب سؤالك عن هذه الآية...', 'Type your question about this ayah...', 'Écrivez votre question sur ce verset...', 'اس آیت کے بارے میں اپنا سوال لکھیں...', 'Bu ayet hakkındaki sorunuzu yazın...'],
  ask: ['اسأل', 'Ask', 'Demander', 'پوچھیں', 'Sor'],
  askNote: ['إجابة آلية مبنية على تفسير الميسر فقط، وقد تخطئ. للفتاوى راجع أهل العلم.',
    'An automatic answer based only on Tafsir Al-Muyassar; it can be wrong. For religious rulings, ask a qualified scholar.',
    'Réponse automatique fondée uniquement sur le Tafsir Al-Muyassar ; elle peut se tromper. Pour les avis religieux, consultez un savant.',
    'یہ خودکار جواب صرف تفسیر میسر پر مبنی ہے اور غلط ہو سکتا ہے۔ فتویٰ کے لیے اہلِ علم سے رجوع کریں۔',
    'Yalnızca El-Müyesser tefsirine dayanan otomatik bir cevaptır, hatalı olabilir. Dini hükümler için bir âlime danışın.'],
  repCount: ['عدد مرات تكرار كل آية', 'How many times to repeat each ayah', 'Nombre de répétitions de chaque verset', 'ہر آیت کتنی بار دہرائی جائے', 'Her ayet kaç kez tekrarlansın'],
  repNone: ['بدون', 'None', 'Aucune', 'کوئی نہیں', 'Yok'],
  repOther: ['عدد آخر:', 'Other number:', 'Autre nombre :', 'دوسری تعداد:', 'Başka sayı:'],
  repNext: ['الانتقال تلقائياً إلى الآية التالية بعد انتهاء التكرار', 'Go on to the next ayah when the repeats are done',
    'Passer au verset suivant après les répétitions', 'تکرار ختم ہونے پر خودبخود اگلی آیت پر جائیں', 'Tekrar bitince sonraki ayete geç'],
  repPlay: ['▶ تشغيل التكرار', '▶ Play repeat', '▶ Lancer la répétition', '▶ تکرار چلائیں', '▶ Tekrarı başlat'],
  repStop: ['■ إيقاف', '■ Stop', '■ Arrêt', '■ روکیں', '■ Durdur'],
  repNote: ['يبدأ من الآية المحددة، أو من أول آية في الصفحة. يعمل مع جميع القرّاء.',
    'Starts from the selected ayah, or the first ayah on the page. Works with every reciter.',
    'Commence au verset choisi, ou au premier verset de la page. Fonctionne avec tous les récitateurs.',
    'منتخب آیت سے، یا صفحے کی پہلی آیت سے شروع ہوتا ہے۔ سب قاریوں کے ساتھ چلتا ہے۔',
    'Seçilen ayetten veya sayfanın ilk ayetinden başlar. Bütün kârilerle çalışır.'],
  repEach: [n => `كل آية ستُكرَّر ${n} مرة.`, n => `Each ayah will be repeated ${n} times.`, n => `Chaque verset sera répété ${n} fois.`,
    n => `ہر آیت ${n} بار دہرائی جائے گی۔`, n => `Her ayet ${n} kez tekrarlanacak.`],
  repOff: ['بدون تكرار (قراءة عادية).', 'No repeat (normal reading).', 'Pas de répétition (lecture normale).', 'کوئی تکرار نہیں (عام تلاوت)۔', 'Tekrar yok (normal okuma).'],
  repNow: [(r, n, m) => `${r} — التكرار ${n} من ${m}`, (r, n, m) => `${r} — repeat ${n} of ${m}`, (r, n, m) => `${r} — répétition ${n} sur ${m}`,
    (r, n, m) => `${r} — تکرار ${n} از ${m}`, (r, n, m) => `${r} — tekrar ${n} / ${m}`],
  trNone: ['العربية (بدون ترجمة)', 'Arabic (no translation)', 'Arabe (sans traduction)', 'عربی (بغیر ترجمہ)', 'Arapça (çevirisiz)'],
  turnPre: ['تقليب الصفحات: ', 'Page turn: ', 'Tourner les pages : ', 'صفحہ پلٹنا: ', 'Sayfa çevirme: '],
  flip: ['قلب الصفحة', 'Page flip', 'Feuilleter', 'صفحہ پلٹیں', 'Sayfa çevir'],
  slide: ['سحب يمين / يسار', 'Slide left / right', 'Glisser gauche / droite', 'دائیں / بائیں کھسکائیں', 'Sağa / sola kaydır'],
  scroll: ['تمرير لأسفل', 'Scroll down', 'Défiler vers le bas', 'نیچے اسکرول کریں', 'Aşağı kaydır'],
  tj: ['التجويد: ', 'Tajweed: ', 'Tajwid : ', 'تجوید: ', 'Tecvid: '],
  awake: ['☀ إبقاء الشاشة مضاءة: ', '☀ Keep screen on: ', '☀ Écran toujours allumé : ', '☀ اسکرین روشن رکھیں: ', '☀ Ekranı açık tut: '],
  on: ['تشغيل', 'On', 'Activé', 'آن', 'Açık'],
  off: ['إيقاف', 'Off', 'Désactivé', 'آف', 'Kapalı'],
  legendBtn: ['دليل الألوان', 'Colour guide', 'Guide des couleurs', 'رنگوں کی رہنمائی', 'Renk rehberi'],
  lg0: ['مد طبيعي', 'Natural madd', 'Madd naturel', 'مدِ طبعی', 'Tabii med'],
  lg1: ['مد جائز', 'Permissible madd', 'Madd permis', 'مدِ جائز', 'Caiz med'],
  lg2: ['مد لازم / واجب', 'Necessary / obligatory madd', 'Madd nécessaire / obligatoire', 'مدِ لازم / واجب', 'Lazım / vacip med'],
  lg3: ['قلقلة', 'Qalqalah', 'Qalqala', 'قلقلہ', 'Kalkale'],
  lg4: ['إخفاء', 'Ikhfa', 'Ikhfa', 'اخفاء', 'İhfa'],
  lg5: ['إقلاب', 'Iqlab', 'Iqlab', 'اقلاب', 'İklab'],
  lg6: ['إدغام', 'Idgham', 'Idgham', 'ادغام', 'İdgam'],
  lg7: ['غنة', 'Ghunnah', 'Ghunna', 'غنہ', 'Gunne'],
  lg8: ['لا يُنطق', 'Not pronounced', 'Non prononcé', 'نہیں پڑھا جاتا', 'Okunmaz'],
  search: ['ابحث عن سورة...', 'Search for a surah...', 'Chercher une sourate...', 'سورت تلاش کریں...', 'Sure ara...'],
  privacy: ['سياسة الخصوصية · Privacy', 'Privacy policy', 'Politique de confidentialité', 'رازداری کی پالیسی · Privacy', 'Gizlilik politikası'],
  loadErr: ['⚠️ تعذّر التحميل. تحقق من الإنترنت.', '⚠️ Could not load. Check your internet.', '⚠️ Chargement impossible. Vérifiez Internet.',
    '⚠️ لوڈ نہیں ہو سکا۔ انٹرنیٹ چیک کریں۔', '⚠️ Yüklenemedi. İnternetinizi kontrol edin.'],
  listErr: ['⚠️ تعذّر التحميل', '⚠️ Could not load', '⚠️ Chargement impossible', '⚠️ لوڈ نہیں ہو سکا', '⚠️ Yüklenemedi'],
  juz: ['الجزء', 'Juz', 'Juz', 'پارہ', 'Cüz'],
  pageW: ['صفحة', 'Page', 'Page', 'صفحہ', 'Sayfa'],
  bism: ['البسملة', 'Bismillah', 'Basmala', 'بسم اللہ', 'Besmele'],
  audioOff: ['التلاوة الصوتية تحتاج إلى الإنترنت. القراءة تعمل بدونه.', 'Recitation audio needs the internet. Reading works without it.',
    'L’audio de la récitation a besoin d’Internet. La lecture fonctionne sans.', 'تلاوت کی آواز کے لیے انٹرنیٹ چاہیے۔ پڑھنا اس کے بغیر بھی چلتا ہے۔',
    'Tilavet sesi için internet gerekir. Okuma internetsiz de çalışır.'],
  notSent: ['لم يُرسل السؤال.', 'The question was not sent.', 'La question n’a pas été envoyée.', 'سوال نہیں بھیجا گیا۔', 'Soru gönderilmedi.'],
  connErr: ['تعذّر الاتصال. تحقق من الإنترنت.', 'Could not connect. Check your internet.', 'Connexion impossible. Vérifiez Internet.',
    'رابطہ نہیں ہو سکا۔ انٹرنیٹ چیک کریں۔', 'Bağlanılamadı. İnternetinizi kontrol edin.'],
  err: ['حدث خطأ.', 'Something went wrong.', 'Une erreur s’est produite.', 'کوئی خرابی ہو گئی۔', 'Bir hata oluştu.'],
  done: ['تم.', 'Done.', 'C’est fait.', 'ہو گیا۔', 'Tamam.'],
  noSR: ['المتصفح لا يدعم الأوامر الصوتية. جرّب Chrome أو Edge.', 'This browser does not support voice commands. Try Chrome or Edge.',
    'Ce navigateur ne gère pas les commandes vocales. Essayez Chrome ou Edge.', 'یہ براؤزر آواز کے احکامات نہیں سمجھتا۔ Chrome یا Edge آزمائیں۔',
    'Bu tarayıcı sesli komutları desteklemiyor. Chrome veya Edge deneyin.'],
  micDenied: ['اسمح للمتصفح باستخدام الميكروفون.', 'Allow the browser to use the microphone.', 'Autorisez le navigateur à utiliser le micro.',
    'براؤزر کو مائیکروفون استعمال کرنے کی اجازت دیں۔', 'Tarayıcının mikrofonu kullanmasına izin verin.'],
  noSpeech: ['لم أسمع شيئًا. حاول مرة أخرى.', 'I did not hear anything. Try again.', 'Je n’ai rien entendu. Réessayez.', 'کچھ سنائی نہیں دیا۔ دوبارہ کوشش کریں۔', 'Bir şey duyamadım. Tekrar deneyin.'],
  listenErr: ['تعذّر الاستماع. حاول مرة أخرى.', 'Could not listen. Try again.', 'Écoute impossible. Réessayez.', 'سن نہیں سکا۔ دوبارہ کوشش کریں۔', 'Dinlenemedi. Tekrar deneyin.'],
  micErr: ['تعذّر تشغيل الميكروفون.', 'Could not start the microphone.', 'Impossible de démarrer le micro.', 'مائیکروفون شروع نہیں ہو سکا۔', 'Mikrofon başlatılamadı.']
};
// Reciter names in Latin letters for English, French and Turkish (Arabic and Urdu keep the Arabic names).
const RECITERS = {
  'ar.alafasy': ['Mishary Alafasy', 'Mişari el-Afasi'], 'ar.husary': ['Mahmoud Al-Husary', 'Mahmud el-Husari'],
  'ar.minshawi': ['Al-Minshawi', 'el-Minşavi'], 'ar.abdulbasitmurattal': ['Abdul Basit', 'Abdulbasit Abdussamed'],
  'ar.abdurrahmaansudais': ['As-Sudais', 'es-Sudeys'], 'ar.aymansowaid': ['Ayman Suwaid', 'Eymen Süveyd']
};
const loc = (k, ...a) => { const e = I18N[k]; if (!e) return k; const v = e[LANGS.indexOf(L)] ?? e[0]; return typeof v === 'function' ? v(...a) : v; };
const rtlLang = () => L === 'ar' || L === 'ur';
// Numbers in Arabic-Indic digits for Arabic and Urdu, normal digits for the other languages.
const num = n => rtlLang() ? ar(n) : String(n);

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
// Tajweed words for a page as [["line:verseId", raw], ...]. Saved copies in data/tj/ work with no internet
// (built from api.quran.com); if one is missing, ask quran.com directly.
function tajweedRows(p) {
  return json('/data/tj/' + p + '.json').catch(() =>
    fetch('https://api.quran.com/api/v4/verses/by_page/' + p + '?words=true&per_page=50&word_fields=text_uthmani_tajweed,line_number')
      .then(r => r.json()).then(d => {
        const rows = [];
        d.verses.forEach(v => v.words.forEach(w => {
          if (w.char_type_name === 'word') rows.push([w.line_number + ':' + v.id, w.text_uthmani_tajweed]);   // we draw our own ayah number
        }));
        return rows;
      }));
}
function tajweed(p) {
  if (!tjCache[p]) {
    tjCache[p] = tajweedRows(p).then(rows => {
      const m = {};
      rows.forEach(([k, raw]) => {
        // Escape everything, then bring back ONLY plain <rule class=name> tags. Any other HTML stays harmless text.
        const html = esc(raw)
          .replace(/&lt;rule class=(?:&quot;)?([a-z_-]+)(?:&quot;)?&gt;/g, '<tajweed class="$1">')
          .replace(/&lt;\/rule&gt;/g, '</tajweed>');
        (m[k] = m[k] || []).push(html);           // one entry per word, in order
      });
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
  catch (e) { if (id === S.loadId) $('book').innerHTML = '<div class="page"><div class="text"><div class="msg">' + esc(loc('loadErr')) + '</div></div></div>'; return; }
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
  setLbl();
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
    // The last line of a surah may be short and is centred, as in print. Every other line is full width.
    const lastSeg = ln[ln.length - 1], la = ayahs[lastSeg[0] - base];
    const ends = lastSeg[2] && la && la.numberInSurah === la.surah.numberOfAyahs;
    h += '<div class="line' + (ends ? ' last' : '') + '">' + ln.map(([g, words, end]) => {
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
const LINE_EM = 19.5;          // a full printed Mushaf line is about 19.5 em wide in the Hafs font
function fitPage(shrink) {
  shrink = typeof shrink === 'number' ? shrink : 1;   // < 1 only on the safety re-run below
  const book = $('book'), reader = $('reader');
  const side = innerWidth > innerHeight;               // a phone held sideways (landscape)
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
  parts.forEach(x => { x.box.style.fontSize = ''; x.pg.style.maxWidth = ''; x.box.classList.remove('flow'); });
  book.style.minHeight = '0';
  let widthSize = Infinity, fitW = Infinity, frameW = 0;
  for (const x of parts) {
    const widths = measure(x), widest = Math.max(0, ...widths);
    // A line with only a few words (e.g. the end of An-Nas) would get huge gaps if stretched to the
    // full width; the printed Mushaf lengthens letters instead, which browsers cannot do. Centre it.
    // Every line is stretched to the full width, as the printed Mushaf does (e.g. page 443 line 13,
    // page 417 line 14). Only a very short last line of a surah (e.g. the end of An-Nas) stays centred.
    x.ls.forEach((l, i) => l.classList.toggle('short', l.classList.contains('last') && widths[i] < widest * 0.5));
    const room = x.box.clientWidth;
    if (!widest || room < 50) { book.style.minHeight = ''; return; }   // not laid out yet
    frameW = x.pg.offsetWidth - room;
    const k = room / widest * 0.98;                                   // fit the width
    fitW = Math.min(fitW, fs * k * shrink);                           // largest size whose lines fit
  }
  const setSize = s => parts.forEach(x => { x.box.style.fontSize = s.toFixed(3) + 'rem'; });
  // One page (phone): the normal page fits the screen. A+ / A− scale the text from there. A phone's
  // page is already as wide as the screen, so text larger than that cannot keep the printed lines:
  // it then flows as wrapped lines and the page scrolls down, so A+ always makes the text bigger.
  // A phone held upright has no A+ / A−: the page is always the whole printed page, exactly fitted
  // (the saved size from sideways / laptop use is ignored there).
  const upright = !spread && !side && innerWidth < 600;
  const zoom = upright ? 1 : fs / BASE_FS;
  if (spread) {
    // Open book: every page as big as the opening pages. The text fills the page width, so a page of
    // 15 lines is taller than the screen and scrolls down (the wheel turns the page at the bottom).
    // Pages 1-2 have short lines; they get the size of a normal page, so all pages look the same.
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const normal = parts[0].box.clientWidth * 0.98 / LINE_EM / rem;
    const want = Math.min(fitW, normal) * zoom;
    if (want > fitW * 1.01) {                  // A+ past the page width: the lines wrap
      parts.forEach(x => x.box.classList.add('flow'));
      setSize(want);
      book.style.minHeight = '';
      return;
    }
    widthSize = want;
  } else {
    // Held sideways, the page fills the whole screen width (no empty space on both sides) and
    // scrolls down; upright, the whole page fits on the screen.
    const base = side ? fitW : Math.min(BASE_FS, fitW);
    widthSize = base * Math.min(1, zoom);
    const want = base * zoom;
    if (want > fitW * 1.01) {
      parts.forEach(x => x.box.classList.add('flow'));
      setSize(want);
      book.style.minHeight = '';
      return;
    }
  }
  let size = widthSize;
  const tallest = () => parts.reduce((a, b) => (b.pg.offsetHeight > a.pg.offsetHeight ? b : a));
  setSize(size);
  // Fit the height too, so the whole page is on screen: only the text scales; header, footer and
  // frame stay the same size. On a very short screen (a phone held sideways) that would make the
  // text too small to read, so there the page keeps the width size and scrolls instead.
  const rs = getComputedStyle(reader);
  const avail = reader.clientHeight - parseFloat(rs.paddingTop) - parseFloat(rs.paddingBottom);
  if (!spread && !side && avail > 200) {
    for (let n = 0; n < 3 && tallest().pg.offsetHeight > avail; n++) {
      const x = tallest(), textH = x.box.offsetHeight, fixedH = x.pg.offsetHeight - textH;
      size *= Math.max(0.3, (avail - fixedH) / textH) * 0.99;
      setSize(size);
    }
    if (spread) size = Math.min(widthSize, size * zoom);
    else if (size < widthSize * 0.6) size = widthSize;
    setSize(size);
  }
  book.style.minHeight = '';
  // On wide screens the page is only as wide as its longest line, like a printed page.
  // Measured again at the final size, so the frame can never be narrower than the text.
  // Both pages of a spread get the same width, so the spine stays in the middle.
  const w = Math.ceil(Math.max(...parts.map(x => Math.max(...measure(x)))) * 1.04 + frameW);
  if (!spread) parts.forEach(x => { if (w < x.pg.offsetWidth) x.pg.style.maxWidth = w + 'px'; });   // book pages: all the same width
  for (const x of parts) {
    // Close the gaps: a line a little shorter than the page would get all the extra room as wide
    // spaces between words and ayahs. Enlarge its words slightly instead (at most 15%), so the gaps
    // stay small; line-height is reduced by the same amount so the page height does not change.
    if (x.box.classList.contains('opening')) continue;
    const full = x.box.clientWidth * 0.995, nat = measure(x);
    x.ls.forEach((l, i) => {
      if (l.matches('.short,.sura,.bism') || !nat[i]) return;
      const k = Math.min(1.15, full / nat[i]);
      if (k > 1.005) { l.style.fontSize = k.toFixed(3) + 'em'; l.style.lineHeight = ((spread ? 1.65 : 2.05) / k).toFixed(3); }
    });
    // A line still clearly short gets the rest the way the printed Mushaf does it: kashida (ـ)
    // lengthens the joins between letters, one stretch near the end of each word.
    const after = measure(x);
    x.ls.forEach((l, i) => {
      if (l.matches('.short,.sura,.bism') || !after[i] || full - after[i] < full * 0.02) return;
      kashida(l, full - after[i]);
    });
  }
  // Safety: a printed line must never stick out of its page (on Android that made the page slide
  // left and right). If one does, fit again a little smaller.
  const worst = Math.max(...parts.map(x => Math.max(...x.ls.map(l => l.scrollWidth / Math.max(1, x.box.clientWidth)))));
  if (worst > 1.005 && shrink > 0.7) fitPage(shrink * 0.99 / worst);
  // Phone upright: put the ☰ circle in the middle of the header row (between the surah and juz boxes),
  // so it never covers the first line of the page.
  const fb = $("fontBtns"), ph = upright && parts[0].pg.querySelector(".phead");
  if (ph) { const r = ph.getBoundingClientRect(); fb.style.top = Math.max(2, r.top + r.height / 2 - 21) + "px"; }
  else fb.style.top = "";
}
// Letters that join to the next letter, combining marks, and letters that can be joined to.
const KD_JOIN = 'بتثجحخسشصضطظعغفقكلمنهيئیـ', KD_MARK = /[ً-ٰٟۖ-ۭ]/,
      KD_NEXT = /[آ-يٱ-ۓ]/;
function kashida(line, room) {
  // Width of one kashida at this line's size, measured between two joined letters: a lone kashida
  // is drawn wider than one inside a word, which made long gaps get far too few kashidas.
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
  line.appendChild(probe);
  probe.textContent = 'بب';
  const w0 = probe.offsetWidth;
  probe.textContent = 'ب' + 'ـ'.repeat(20) + 'ب';
  const kw = (probe.offsetWidth - w0) / 20;
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
  for (let tries = 0; tries < 10 && need >= 1; tries++) {
    // Spread evenly over the words: normally at most 4 per word, more on a line with few words.
    const cap = Math.max(4, Math.ceil(need / spots.length));
    const count = spots.map((_, i) => Math.min(cap, Math.floor(need * (i + 1) / spots.length) - Math.floor(need * i / spots.length)));
    for (let i = spots.length - 1; i >= 0; i--) {
      const [n, at] = spots[i];
      if (count[i]) n.data = n.data.slice(0, at) + 'ـ'.repeat(count[i]) + n.data.slice(at);
    }
    box.classList.add('measure');
    const w = line.offsetWidth;
    box.classList.remove('measure');
    if (w <= limit) { line._kd = [...orig]; return; }
    orig.forEach((d, n) => { n.data = d; });  // a little too wide: undo and try with fewer
    need = Math.floor(need * 0.9);
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
if (document.fonts) {
  document.fonts.ready.then(() => fitPage());
  // The Quran font can arrive after the page was first measured with a narrower stand-in font;
  // measure again when it does, or the lines come out too wide for the screen.
  document.fonts.addEventListener('loadingdone', refit);
}

// ---------- Tap handling ----------
// The big circle at the top opens and closes the menu with all the buttons.
function setMenu(open) {
  document.body.classList.toggle('menu', open);
  $('menuBtn').setAttribute('aria-expanded', open);
  $('menuBtn').textContent = open ? '✕' : '☰';
}
$('menuBtn').onclick = e => { e.stopPropagation(); setMenu(!document.body.classList.contains('menu')); };
// Open book on a laptop / desktop: a mouse click on the outer edge of a page turns it, like taking
// hold of a real page. Left page = next, right page = previous (Arabic books open to the left).
// The rest of the page still works as before: click an ayah for its tafsir.
function edgeTurn(e) {
  if (!S.spread || e.pointerType === 'touch') return 0;
  const pg = e.target.closest && e.target.closest('#book > .page');
  if (!pg) return 0;
  const r = pg.getBoundingClientRect(), edge = r.width * 0.2;
  if (pg === $('book').firstElementChild) return e.clientX > r.right - edge ? -1 : 0;
  return e.clientX < r.left + edge ? 1 : 0;
}
$('reader').addEventListener('mousemove', e => {
  const d = edgeTurn(e);
  bookPages().forEach((pg, i) => pg.classList.toggle('hot', !!d && i === (d > 0 ? 1 : 0)));
});
$('reader').addEventListener('mouseleave', () => bookPages().forEach(pg => pg.classList.remove('hot')));
// Dragging a page with the mouse also turns it (drag to the right = next, as with a finger).
let mdx = null, dragged = false;
$('reader').addEventListener('mousedown', e => { mdx = S.spread && e.button === 0 ? e.clientX : null; dragged = false; });
$('reader').addEventListener('mouseup', e => {
  if (mdx === null) return;
  const dx = e.clientX - mdx; mdx = null;
  if (Math.abs(dx) > 60 && !getSelection().toString()) { dragged = true; go(dx > 0 ? 1 : -1); }
});
$('reader').addEventListener('click', e => {
  if (dragged) { dragged = false; return; }
  closeList();
  const d = edgeTurn(e);
  if (d) { closeSheet(); return go(d); }
  const a = e.target.closest('.ayah');
  if (a) return selectAyah(+a.dataset.i);
  if ($('sheet').classList.contains('open')) return closeSheet();
  setMenu(!document.body.classList.contains('menu'));
});

function selectAyah(i) {
  S.sel = i;
  $('book').querySelectorAll('.ayah.sel').forEach(e => e.classList.remove('sel'));
  $('book').querySelectorAll(`.ayah[data-i="${i}"]`).forEach(e => e.classList.add('sel'));
  const a = S.ayahs[i];
  $('ref').textContent = refText(a);
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
  const fail = () => { stopAudio(); if (!navigator.onLine) showVoice('', loc('audioOff'), true); };
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
  btn.innerHTML = '🔁' + (S.rep > 1 ? `<b class="badge">${num(S.rep)}</b>` : '');
  btn.classList.toggle('on', S.rep > 1);
  document.querySelectorAll('#repPresets button').forEach(b => b.classList.toggle('on', +b.dataset.n === S.rep));
  if (document.activeElement !== $('repN')) $('repN').value = S.rep;
  $('repNext').checked = S.autoNext;
  const p = S.playing, a = p && S.ayahs[p.i];
  $('repStat').textContent = !a ? (S.rep > 1 ? loc('repEach', num(S.rep)) : loc('repOff')) : loc('repNow', refText(a), num(p.n), num(S.rep));
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
  $('turnBtn').title = loc('turnPre') + loc(S.turn);
  store.set('turn', S.turn);
}
const TURN_ICONS = { flip: '📖', slide: '↔', scroll: '↕' };
$('turnSel').onchange = () => setTurn($('turnSel').value);
// Top-bar button: each tap moves to the next way, and says which one is now on.
let turnMsgTimer;
$('turnBtn').onclick = () => {
  setTurn(TURNS[(TURNS.indexOf(S.turn) + 1) % TURNS.length]);
  const lbl = $('lbl'), old = lbl.dataset.old ?? lbl.textContent;
  lbl.dataset.old = old;
  const msg = lbl.textContent = TURN_ICONS[S.turn] + ' ' + loc(S.turn);
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
// Full screen on a laptop / desktop: the ⛶ circle (top corner or menu) or the F key; Esc leaves it.
// The book re-fits itself to the bigger screen. Hidden where the browser cannot do it (iPhone).
const fsEl = document.documentElement;
const fsOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function toggleFullscreen() {
  if (fsOn()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else {
    const req = fsEl.requestFullscreen || fsEl.webkitRequestFullscreen;
    const r = req && req.call(fsEl);
    if (r && r.catch) r.catch(() => {});
  }
}
function showFs() {
  const on = fsOn();
  document.querySelectorAll('.fsBtn').forEach(b => { b.textContent = on ? '🗗' : '⛶'; b.title = loc(on ? 'fsExit' : 'fs') + ' (F)'; });
  const lbl = $('fsMenu').nextElementSibling;
  if (lbl) lbl.textContent = loc(on ? 'fsExit' : 'fs');
}
if (!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen)) document.body.classList.add('noFs');
document.querySelectorAll('.fsBtn').forEach(b => b.onclick = e => { e.stopPropagation(); toggleFullscreen(); });
document.addEventListener('fullscreenchange', showFs);
document.addEventListener('webkitfullscreenchange', showFs);
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if ((e.key === 'f' || e.key === 'F' || e.key === 'ب') && !e.ctrlKey && !e.metaKey && !e.altKey) toggleFullscreen();
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
  if (S.turn !== 'scroll' && !S.spread) return;     // the open book on a laptop turns with the wheel too
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
  ).map(s => `<li data-n="${esc(s.number)}"><span>${esc(num(s.number))}</span><span>${esc(s.name)}<br><small>${esc(s.englishName)} · ${esc(num(s.numberOfAyahs))}</small></span></li>`).join('');
}
async function openList() {
  $('drawer').classList.add('open');
  setMenu(false);
  if (!S.surahs) {
    try { S.surahs = (await db()).surahs; renderList(); }
    catch (e) { $('list').innerHTML = '<li>' + esc(loc('listErr')) + '</li>'; }
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
$('trSel').onchange = () => { store.set('tr', $('trSel').value); applyLang(); if (S.sel >= 0) fill(S.sel); };
$('rec').onchange = () => { store.set('rec', $('rec').value); };

// ---------- Tajweed switch ----------
function setTajweed(on) {
  document.body.classList.toggle('tj', on);
  $('tjBtn').textContent = loc('tj') + loc(on ? 'on' : 'off');
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
let fs = parseFloat(store.get('fs2')) || 1.9;      // fs2: sizes are now relative to the fitted page
function setFont(v) {
  fs = Math.max(1.0, Math.min(5, +v.toFixed(1)));
  document.documentElement.style.setProperty('--fs', fs + 'rem');
  store.set('fs2', fs);
  fitPage();
}
// Each tap changes the size by about 10%, so it is easy to see.
$('fMinus').onclick = e => { e.stopPropagation(); setFont(fs - 0.2); };
$('fPlus').onclick = e => { e.stopPropagation(); setFont(fs + 0.2); };

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
  $('awakeBtn').textContent = loc('awake') + loc(on ? 'on' : 'off');
  $('awakeBtn').setAttribute('aria-pressed', on);
  if (on) keepAwake();
  else if (wakeLock) { const l = wakeLock; wakeLock = null; l.release().catch(() => {}); }
}
$('awakeBtn').onclick = () => setAwake(!S.awake);
document.addEventListener('visibilitychange', keepAwake);
['click', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, keepAwake, { passive: true }));

// ---------- App language (see I18N at the top) ----------
// Surah + ayah as shown in the menu, the tafsir sheet and the repeat panel.
function refText(a) {
  const latin = !rtlLang(), name = latin ? a.surah.englishName : a.surah.name;
  if (a.surah.number === 1 && a.numberInSurah === 1) return `${name} · ${loc('bism')}`;
  return latin ? `${name} ${a.surah.number}:${shownNo(a)}` : `${name} ﴿${num(shownNo(a))}﴾`;
}
// The line at the top of the menu: surah · juz · page.
function setLbl() {
  const first = S.ayahs[0];
  if (!first) return;
  const p = S.page, name = rtlLang() ? first.surah.name : first.surah.englishName;
  $('lbl').textContent = `${name} · ${loc('juz')} ${num(first.juz)} · ${loc('pageW')} ${num(p)}${S.spread ? '–' + num(p + 1) : ''}`;
}
function applyLang() {
  L = store.get('tr') ? (LANG_OF[$('trSel').value] || 'ar') : 'ar';
  const dir = rtlLang() ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-t]').forEach(e => { e.textContent = loc(e.dataset.t); });
  document.querySelectorAll('[data-tt]').forEach(e => { e.title = loc(e.dataset.tt); });
  document.querySelectorAll('[data-tp]').forEach(e => { e.placeholder = loc(e.dataset.tp); });
  document.querySelectorAll('[data-ta]').forEach(e => { e.setAttribute('aria-label', loc(e.dataset.ta)); });
  document.title = loc('title');
  // The panels read left to right in English, French and Turkish. The menu keeps its right-to-left order,
  // because its ▶ / ◀ buttons follow the direction pages turn in the Mushaf.
  ['sheet', 'repPanel', 'vp', 'drawer'].forEach(id => { $(id).dir = dir; $(id).lang = L; });
  $('menu').lang = L; $('lbl').dir = dir;
  [...$('rec').options].forEach(o => {
    if (!o.dataset.ar) o.dataset.ar = o.textContent;
    const n = RECITERS[o.value];
    o.textContent = n && !rtlLang() ? n[L === 'tr' ? 1 : 0] : o.dataset.ar;
  });
  [...$('turnSel').options].forEach(o => { o.textContent = loc('turnPre') + loc(o.value); });
  document.querySelectorAll('#repPresets button').forEach(b => { b.textContent = b.dataset.n === '1' ? loc('repNone') : num(b.dataset.n); });
  setTajweed(document.body.classList.contains('tj'));
  setAwake(S.awake);
  showFs();
  setTurn(S.turn);
  showRep();
  setLbl();
  if (S.sel >= 0) $('ref').textContent = refText(S.ayahs[S.sel]);
  if (S.surahs) renderList();
}

// ---------- Start ----------
setAwake(S.awake);
setTheme(store.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
setFont(fs);
// Nothing chosen yet = Arabic, with no translation (the app's language follows this list).
$('trSel').value = store.get('tr') || 'none';
if (!$('trSel').value) $('trSel').value = 'none';
if (store.get('rec')) $('rec').value = store.get('rec');
if (!$('rec').value) $('rec').selectedIndex = 0;
setTajweed(store.get('tj') === '1');
setTurn(store.get('turn'));
applyLang();
loadPage(parseInt(store.get('lastPage')) || 1, { noAnim: true });

// ---------- Ask the assistant (typed box + voice share one endpoint) ----------
// On the website the assistant is at /api/ask. The iPhone app carries the site inside it
// (capacitor://localhost), so it has to call the website's server by its full address.
const ASK_URL = location.protocol.startsWith('http') ? '/api/ask' : 'https://www.laithissa.online/api/ask';

// Ask once before the first question is sent to Google Gemini (required by the App Store, fair on the web too).
function aiConsent() {
  if (store.get('aiOk') === '1') return Promise.resolve(true);
  return new Promise(done => {
    const bg = document.createElement('div');
    bg.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    bg.innerHTML = `<div dir="rtl" style="max-width:420px;background:var(--page,#fff);color:var(--text,#222);border-radius:18px;padding:20px;font:16px/1.6 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.4)">
      <b style="font-size:18px">المساعد الذكي</b>
      <p style="margin:10px 0">للإجابة، يُرسل سؤالك ورقم الصفحة والآية المختارة إلى خادمنا ثم إلى خدمة <b>Google Gemini</b> للذكاء الاصطناعي. لا تكتب معلومات شخصية. للبالغين ١٨ سنة فأكثر.</p>
      <p dir="ltr" style="margin:10px 0;font-size:14px;opacity:.85">To answer, your question, page and selected ayah are sent to our server and then to <b>Google Gemini</b> AI. Don't type personal information. Adults 18+ only.</p>
      <a href="privacy.html" target="_blank" style="font-size:14px">سياسة الخصوصية · Privacy policy</a>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button data-ok style="flex:1;padding:12px;border:0;border-radius:999px;background:#3d7a55;color:#fff;font-size:16px">موافق · Agree</button>
        <button data-no style="flex:1;padding:12px;border:0;border-radius:999px;background:#8884;color:inherit;font-size:16px">لا · No</button>
      </div></div>`;
    const end = ok => { bg.remove(); if (ok) store.set('aiOk', '1'); done(ok); };
    bg.querySelector('[data-ok]').onclick = () => end(true);
    bg.querySelector('[data-no]').onclick = () => end(false);
    document.body.appendChild(bg);
  });
}

async function askServer(q, useAyah) {
  if (!await aiConsent()) throw new Error(loc('notSent'));
  const body = { question: q, state: { page: S.page, surah: S.ayahs[0] ? S.ayahs[0].surah.number : null } };
  if (useAyah && S.sel >= 0) { const a = S.ayahs[S.sel]; body.surah = a.surah.number; body.ayah = a.numberInSurah; }
  let r, d;
  try {
    r = await fetch(ASK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    d = await r.json();
  } catch (e) { throw new Error(loc('connErr')); }
  if (!r.ok) throw new Error(d.error || loc('err'));
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
    case 'translation': $('trSel').value = d.value; store.set('tr', d.value); applyLang(); if (S.sel >= 0) fill(S.sel); break;
    case 'theme': setTheme(d.value); break;
    case 'font': setFont(fs + (d.value === 'up' ? 0.2 : -0.2)); break;
    case 'play': if (S.audio && S.audio.paused) togglePlay(); else if (!S.audio) playFrom(S.sel >= 0 ? S.sel : 0); break;
    case 'stop': stopAudio(); break;
    default: break;            // "answer": nothing to do on the page
  }
  return say || loc('done');
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
    if (S.sel === i) { $('ans').className = 'err'; $('ans').textContent = e.message || loc('err'); }
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
  } catch (e) { showVoice(text, e.message || loc('connErr'), true); }
}
function startVoice() {
  if (!SR) return showVoice('', loc('noSR'), true);
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
    const msg = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? loc('micDenied')
      : e.error === 'no-speech' ? loc('noSpeech') : loc('listenErr');
    showVoice('', msg, true);
  };
  recog.onend = () => { listening = false; setMic(false); if (heard) handleVoice(heard); };
  try { recog.start(); } catch (e) { showVoice('', loc('micErr'), true); }
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
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
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
