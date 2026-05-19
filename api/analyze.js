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

  if (API_KEYS.length === 0) return res.status(500).json({ error: 'No API keys configured' });

  const prompt = `다음은 한국어로 작성된 일상적 '말 참음' 상황 기록입니다. 아래 7개 감정 카테고리만 사용하여 분석하고 반드시 JSON만 반환하세요. 다른 텍스트 없이 JSON만.

사용 가능한 감정은 오직 이 7개뿐입니다: 억울함, 분노, 서운함, 두려움, 불안, 답답함, 무기력
다른 감정 이름(슬픔, 화남, 짜증 등)은 절대 사용하지 마세요.

{"emotions":{"억울함":정수,"분노":정수,"서운함":정수,"두려움":정수,"불안":정수,"답답함":정수,"무기력":정수},"dominant":"위 7개 중 가장 높은 감정 이름","insight":"2문장 한국어 설명. 말 참음 상황에서 느낀 감정을 외재화 관점으로 따뜻하게."}

규칙:
- 7개 감정의 합은 반드시 정확히 100
- 모든 감정 포함 (0이어도 반드시 포함)
- JSON 외 다른 텍스트 절대 금지

텍스트: ${text}`;

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
        if (data.error.code === 429 || data.error.code === 503) continue;
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
      try { parsed = JSON.parse(jsonMatch[0]); } catch (e) { continue; }

      return res.status(200).json(parsed);
    } catch (e) { continue; }
  }

  return res.status(500).json({ error: '모든 API 키의 할당량이 초과됐어요. 잠시 후 다시 시도해주세요.' });
}
