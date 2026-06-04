export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { records } = req.body;
  if (!records || records.length === 0) return res.status(400).json({ error: 'records required' });

  const API_KEYS = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean);

  if (API_KEYS.length === 0) return res.status(500).json({ error: 'No API keys configured' });

  const summary = records.map(r =>
    `${r.day}회차: 억울함${r.emotions['억울함']}% 분노${r.emotions['분노']}% 서운함${r.emotions['서운함']}% 두려움${r.emotions['두려움']}% 불안${r.emotions['불안']}% 답답함${r.emotions['답답함']}% 무기력${r.emotions['무기력']}% 스트레스강도${r.stress||5}/10 (주된감정:${r.dominant})`
  ).join('\n');

  const prompt = `당신은 임상심리학적 관점에서 감정 데이터를 해석하는 전문가입니다.

아래는 일상적 '말 참음' 스트레스 완화 프로그램 참가자의 감정 기록입니다.
이 프로그램은 표현적 글쓰기와 자기주장 훈련을 통해 말 참음으로 인한 스트레스를 완화하는 것을 목적으로 합니다.

${summary}

다음 세 가지를 한국어로 작성해주세요. 반드시 JSON 형식으로만 반환하세요.

{
  "pattern": "감정 변화 패턴을 2-3문장으로 설명. 구체적인 수치 언급. 말 참음 맥락으로.",
  "clinical": "임상심리학적 관점에서 이 패턴의 의미를 2-3문장으로 해석. 표현억제, 회피적 대처, 자기주장, 감정조절 등 관련 개념 활용.",
  "message": "참가자에게 전하는 따뜻하고 전문적인 응원 메시지 2문장. 말 참음 상황 개선에 초점."
}

JSON만 반환하고 다른 텍스트는 절대 포함하지 마세요.`;

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
            temperature: 0.3,
            maxOutputTokens: 1000,
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

  return res.status(500).json({ error: '모든 API 키의 할당량이 초과됐어요.' });
}
