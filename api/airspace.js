// Vercel Serverless Function - Proxy for DJI FlySafe API

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { lat, lng, country = 'GB', drone = 'spark' } = req.query;

    if (!lat || !lng) {
        return res.status(400).json({ error: 'Missing required parameters: lat, lng' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // Build URL via string concatenation - URLSearchParams encodes commas in
    // the level param (0%2C1%2C2...) which the DJI API does not accept
    const djiUrl = `https://www-api.dji.com/api/geo/areas?drone=${drone}&zones_mode=total&country=${country}&level=0,1,2,3,4,5,6,7,8,9&lat=${latitude}&lng=${longitude}&search_radius=10000`;

    console.log('[1] Calling DJI API:', djiUrl);

    let response;
    try {
        response = await fetch(djiUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Prelude-Airspace-Map/1.0'
            },
            signal: AbortSignal.timeout(10000)
        });
    } catch (fetchErr) {
        console.error('[2] Fetch failed:', fetchErr.name, fetchErr.message);
        const status = (fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError') ? 504 : 502;
        return res.status(status).json({ error: fetchErr.message });
    }

    console.log('[3] DJI HTTP status:', response.status, response.statusText);

    if (!response.ok) {
        return res.status(502).json({ error: 'DJI API unavailable', status: response.status });
    }

    let data;
    try {
        data = await response.json();
    } catch (parseErr) {
        console.error('[4] JSON parse failed:', parseErr.message);
        return res.status(502).json({ error: 'DJI response was not valid JSON' });
    }

    console.log('[5] data.status:', data.status, '| extra type:', typeof data.extra, '| extra keys:', data.extra ? Object.keys(data.extra) : 'null');

    if (Number(data.status) !== 200) {
        console.error('[6] DJI error status:', data.status, 'msg:', data.extra?.msg);
        return res.status(502).json({ error: 'DJI API error', status: data.status, msg: data.extra?.msg });
    }

    console.log('[7] extra sample:', JSON.stringify(data.extra)?.slice(0, 300));

    const zones = data.extra?.areas || [];

    console.log('[8] Zone count:', zones.length);
    if (zones.length > 0) {
        console.log('[9] First zone keys:', Object.keys(zones[0]));
        console.log('[9] First zone:', JSON.stringify(zones[0]));
    }

    res.setHeader('Cache-Control', 'public, s-maxage=3600');

    return res.status(200).json({
        zones,
        count: zones.length,
        location: { lat: latitude, lng: longitude }
    });
}
