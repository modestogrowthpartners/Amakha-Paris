exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { connector, date_from, date_to } = event.queryStringParameters || {};
  const API_KEY = process.env.WINDSOR_API_KEY;

  if (!API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'WINDSOR_API_KEY not set' }) };
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
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid connector' }) };
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

    const allowed = new Set(c.accounts.map(a => a.replace(/-/g, '')));
    rows = rows.filter(r => {
      const acc = String(r.account_id || '').replace(/-/g, '');
      if (!acc) return true;
      return allowed.has(acc);
    });

    rows = rows.filter(r => (parseFloat(r.spend) || 0) > 0 || (parseFloat(r.impressions) || 0) > 0);

    return { statusCode: 200, headers, body: JSON.stringify({ rows }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
