export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const connector = searchParams.get('connector');
  const date_from = searchParams.get('date_from');
  const date_to   = searchParams.get('date_to');
  const API_KEY   = process.env.WINDSOR_API_KEY;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'WINDSOR_API_KEY not set' }), { status: 500, headers });
  }

  const cfg = {
    google_ads: {
      fields: 'date,campaign,spend,impressions,clicks,conversions,account_id',
      accounts: ['407-456-8221'],
    },
    facebook: {
      fields: 'date,campaign_name,spend,impressions,clicks,reach,account_id',
      accounts: ['541549713104937', '903503191640761'],
    },
  };

  const c = cfg[connector];
  if (!c) {
    return new Response(JSON.stringify({ error: 'Invalid connector' }), { status: 400, headers });
  }

  // Build URL with correct accounts[] format
  const parts = [
    `api_key=${API_KEY}`,
    `fields=${encodeURIComponent(c.fields)}`,
    `date_from=${date_from}`,
    `date_to=${date_to}`,
    ...c.accounts.map(a => `accounts%5B%5D=${encodeURIComponent(a)}`),
  ];

  const url = `https://connectors.windsor.ai/${connector}?${parts.join('&')}`;

  try {
    const resp = await fetch(url);
    const raw  = await resp.json();
    let rows   = Array.isArray(raw) ? raw : (raw.data || raw.results || []);

    // Double-check: only keep rows from allowed accounts
    const allowed = new Set(c.accounts.map(a => a.replace(/-/g, '')));
    rows = rows.filter(r => {
      const acc = String(r.account_id || '').replace(/-/g, '');
      if (!acc) return true;
      return allowed.has(acc);
    });

    // Remove rows with no spend AND no impressions
    rows = rows.filter(r => (parseFloat(r.spend) || 0) > 0 || (parseFloat(r.impressions) || 0) > 0);

    return new Response(JSON.stringify({ rows }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
}
