export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `다음 한국어 텍스트의 감정을 분석해서 JSON으로 반환해줘. 반드시 순수 JSON만 출력해. 백틱이나 설명 없이.

형식: {"emotions":{"슬픔":숫자,"불안":숫자,"그리움":숫자,"죄책감":숫자,"두려움":숫자,"사랑":숫자,"평온":숫자},"dominant":"가장높은감정","insight":"2문장설명"}

규칙: 모든 감정 합계=100, 0인 감정도 포함

텍스트: ${text}`
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 300,
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message, code: data.error.code });
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!raw) {
      return res.status(500).json({ error: 'Empty response from Gemini', data: JSON.stringify(data).slice(0, 500) });
    }

    const cleaned = raw.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.status(500).json({ error: 'JSON parse failed', raw: cleaned.slice(0, 300) });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack?.slice(0, 200) });
  }
}
