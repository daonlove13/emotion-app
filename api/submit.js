export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, day, date } = req.body;
  if (!name || !day || !date) return res.status(400).json({ error: 'name, day, date required' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  const SHEETS_URL = process.env.GOOGLE_SHEETS_URL;

  const results = await Promise.allSettled([
    // Supabase 저장
    SUPABASE_URL && SUPABASE_KEY ? fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ name, day, date })
    }) : Promise.resolve(),

    // Google Sheets 저장
    SHEETS_URL ? fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, day, date })
    }) : Promise.resolve()
  ]);

  return res.status(200).json({ success: true });
}
