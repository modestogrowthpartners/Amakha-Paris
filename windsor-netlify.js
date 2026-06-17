export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { connector, date_from, date_to } = req.query;
  const API_KEY = process.env.WINDSOR_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'WINDSOR_API_KEY not set' });
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
    return res.status(400).json({ error: 'Invalid connector' });
  }

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

    // Double check: filter by allowed account_id
    const allowed = new Set(c.accounts.map(a => a.replace(/-/g, '')));
    rows = rows.filter(r => {
      const acc = String(r.account_id || '').replace(/-/g, '');
      if (!acc) return true;
      return allowed.has(acc);
    });

    // Remove rows with no metrics
    rows = rows.filter(r => (parseFloat(r.spend) || 0) > 0 || (parseFloat(r.impressions) || 0) > 0);

    return res.status(200).json({ rows });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
