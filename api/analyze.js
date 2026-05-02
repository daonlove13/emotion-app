export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `당신은 한국어 텍스트에서 감정을 분석하는 도구입니다.
아래 텍스트의 감정을 분석하고 반드시 JSON만 반환하세요. 백틱, 설명, 마크다운 없이 순수한 JSON 객체만 출력하세요.

형식:
{"emotions":{"슬픔":정수,"불안":정수,"그리움":정수,"죄책감":정수,"두려움":정수,"사랑":정수,"평온":정수},"dominant":"가장 높은 감정","insight":"2문장으로 감정을 나와 분리해서 외재화 관점으로 따뜻하게 설명"}

규칙:
- 모든 감정의 합은 반드시 100
- 0인 감정도 포함
- JSON 외 다른 텍스트 절대 금지

분석할 텍스트: ${text}`
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'Gemini API error' });
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse response', raw: cleaned });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
