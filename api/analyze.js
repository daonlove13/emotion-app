export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyze emotions in this Korean text. Return ONLY valid JSON, no other text.

{"emotions":{"슬픔":int,"불안":int,"그리움":int,"죄책감":int,"두려움":int,"사랑":int,"평온":int},"dominant":"감정이름","insight":"2문장 한국어 설명"}

Rules: all integers, sum=100, output JSON only.

Text: ${text}`
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1500,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    var fullText = '';
    var parts = data.candidates?.[0]?.content?.parts || [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].text) fullText += parts[i].text;
    }

    if (!fullText) {
      return res.status(500).json({ error: 'Empty response' });
    }

    var cleaned = fullText.replace(/```json/g, '').replace(/```/g, '').trim();
    var jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.status(500).json({ error: 'No JSON found', debug: cleaned.slice(0, 300) });
    }

    var parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return res.status(500).json({ error: 'JSON parse error', debug: jsonMatch[0].slice(0, 300) });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
