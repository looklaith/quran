// api/ask.js  (runs on Vercel, the key never reaches the browser)
const MODEL = 'gemini-2.5-flash';
const MAX_QUESTION = 400;

// Simple per-visitor limit: 10 questions per hour (resets when the server restarts)
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 3600000);
  if (list.length >= 10) return true;
  list.push(now);
  hits.set(ip, list);
  return false;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server key is not set.' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ error: 'Too many questions. Please try again in an hour.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const question = String(body.question || '').trim().slice(0, MAX_QUESTION);
  const ayah = String(body.ayah || '').slice(0, 3000);
  const tafsir = String(body.tafsir || '').slice(0, 4000);
  const ref = String(body.ref || '').slice(0, 100);
  if (!question) return res.status(400).json({ error: 'Please type a question.' });

  const system =
    'You help people understand the Quran. You are given one ayah and its short tafsir. ' +
    'Answer ONLY from the ayah and tafsir provided. Never write or recite Quran text from memory; ' +
    'if you mention an ayah, refer to it by surah and number only. ' +
    'If the answer is not in the provided material, say clearly that you do not know from this material. ' +
    'Reply in the same language as the question, in a few short sentences, in a respectful tone. ' +
    'For questions about religious rulings (halal, haram, fatwa, what a person must do), do not give a ruling; ' +
    'explain what the tafsir says and advise asking a qualified scholar.';

  const prompt =
    `Ayah (${ref}): ${ayah}\n\nTafsir: ${tafsir}\n\nQuestion: ${question}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 600 }
        })
      }
    );
    const data = await r.json();
    if (!r.ok) {
      const busy = r.status === 429;
      return res.status(busy ? 429 : 502).json({
        error: busy ? 'The free daily limit is reached. Please try again later.' : 'The AI service had a problem. Please try again.'
      });
    }
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    res.status(200).json({ answer: text || 'No answer was returned. Please rephrase the question.' });
  } catch (e) {
    res.status(502).json({ error: 'Could not reach the AI service.' });
  }
};