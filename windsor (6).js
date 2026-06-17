export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const connector  = searchParams.get('connector');
  const date_from  = searchParams.get('date_from');
  const date_to    = searchParams.get('date_to');
  const API_KEY    = process.env.WINDSOR_API_KEY;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (!API_KEY) return new Response(JSON.stringify({ error: 'API key missing' }), { status: 500, headers });

  const cfg = {
    google_ads: {
      fields: 'date,campaign,spend,impressions,clicks,conversions',
      accounts: ['407-456-8221'],
    },
    facebook: {
      fields: 'date,campaign_name,spend,impressions,clicks,reach',
      accounts: ['541549713104937', '903503191640761'],
    },
  };

  const c = cfg[connector];
  if (!c) return new Response(JSON.stringify({ error: 'Invalid connector' }), { status: 400, headers });

  const params = new URLSearchParams({ api_key: API_KEY, fields: c.fields, date_from, date_to });
  c.accounts.forEach(a => params.append('accounts[]', a));

  try {
    const resp = await fetch(`https://connectors.windsor.ai/${connector}?${params}`);
    const raw  = await resp.json();
    const rows = Array.isArray(raw) ? raw : (raw.data || raw.results || []);
    // Remove rows with zero spend AND zero impressions
    const filtered = rows.filter(r => (parseFloat(r.spend)||0) > 0 || (parseFloat(r.impressions)||0) > 0);
    return new Response(JSON.stringify({ rows: filtered }), { status: 200, headers });
  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
}
