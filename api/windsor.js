export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { connector, date_from, date_to } = req.query;
  const API_KEY = process.env.WINDSOR_API_KEY;

  if (!API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const fieldsMap = {
    google_ads: 'date,campaign,spend,impressions,clicks,conversions,cost_per_conversion',
    facebook:   'date,campaign_name,spend,impressions,clicks,reach',
  };

  const accountsMap = {
    google_ads: ['407-456-8221'],
    facebook:   ['541549713104937', '903503191640761'],
  };

  const fields = fieldsMap[connector];
  if (!fields) return res.status(400).json({ error: 'unsupported connector' });

  const params = new URLSearchParams({
    api_key: API_KEY,
    connector,
    fields,
    date_from: date_from || '',
    date_to:   date_to   || '',
  });
  accountsMap[connector].forEach(a => params.append('accounts[]', a));

  try {
    const upstream = await fetch(`https://connectors.windsor.ai/v1?${params}`);
    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
