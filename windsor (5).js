export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { connector, date_from, date_to } = req.query;
  const API_KEY = process.env.WINDSOR_API_KEY;

  if (!API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const fieldsMap = {
    google_ads: 'date,campaign,spend,impressions,clicks,conversions,account_id',
    facebook:   'date,campaign_name,spend,impressions,clicks,reach,account_id',
  };

  // SOMENTE contas Amakha Paris
  const accountsMap = {
    google_ads: ['407-456-8221'],
    facebook:   ['541549713104937', '903503191640761'],
  };

  const allowedAccounts = {
    google_ads: new Set(['407-456-8221']),
    facebook:   new Set(['541549713104937', '903503191640761']),
  };

  const fields = fieldsMap[connector];
  if (!fields) return res.status(400).json({ error: 'unsupported connector' });

  const params = new URLSearchParams({
    api_key: API_KEY,
    fields,
    date_from: date_from || '',
    date_to:   date_to   || '',
  });
  accountsMap[connector].forEach(a => params.append('accounts[]', a));

  const url = `https://connectors.windsor.ai/${connector}?${params}`;

  try {
    const upstream = await fetch(url);
    const data = await upstream.json();
    let rows = Array.isArray(data) ? data : (data.data || data.results || []);

    // Filtra somente contas permitidas da Amakha Paris
    const allowed = allowedAccounts[connector];
    rows = rows.filter(r => {
      const acc = String(r.account_id || r.accountId || '').replace(/-/g, '');
      // Se não tem account_id no row, mantém (já filtrado pela query)
      if (!acc) return true;
      return allowed.has(acc) || allowed.has(r.account_id);
    });

    // Remove campanhas sem métricas (sem spend e sem impressions)
    rows = rows.filter(r => {
      const spend = parseFloat(r.spend) || 0;
      const impr = parseFloat(r.impressions) || 0;
      return spend > 0 || impr > 0;
    });

    return res.status(200).json({ rows });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
