export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const API_KEYS = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean);

  if (API_KEYS.length === 0) {
    return res.status(500).json({ error: 'No API keys configured' });
  }

  const prompt = `Analyze emotions in this Korean text. Return ONLY valid JSON, no other text.

{"emotions":{"슬픔":int,"불안":int,"그리움":int,"죄책감":int,"두려움":int,"사랑":int,"평온":int},"dominant":"감정이름","insight":"2문장 한국어 설명"}

Rules: all integers, sum=100, output JSON only.

Text: ${text}`;

  for (var i = 0; i < API_KEYS.length; i++) {
    const apiKey = API_KEYS[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1500,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      });

      const data = await response.json();

      if (data.error) {
        const code = data.error.code;
        if (code === 429 || code === 503) continue;
        return res.status(500).json({ error: data.error.message });
      }

      var fullText = '';
      var parts = data.candidates?.[0]?.content?.parts || [];
      for (var j = 0; j < parts.length; j++) {
        if (parts[j].text) fullText += parts[j].text;
      }

      if (!fullText) continue;

      var cleaned = fullText.replace(/```json/g, '').replace(/```/g, '').trim();
      var jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      var parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        continue;
      }

      return res.status(200).json(parsed);

    } catch (e) {
      continue;
    }
  }

  return res.status(500).json({ error: '모든 API 키의 할당량이 초과됐어요. 잠시 후 다시 시도해주세요.' });
}
