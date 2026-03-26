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

    const djiUrl = new URL('https://www-api.dji.com/api/geo/areas');
    djiUrl.searchParams.set('drone', drone);
    djiUrl.searchParams.set('zones_mode', 'total');
    djiUrl.searchParams.set('country', country);
    djiUrl.searchParams.set('level', '0,1,2,3,4,5,6,7,8,9');
    djiUrl.searchParams.set('lat', latitude);
    djiUrl.searchParams.set('lng', longitude);
    djiUrl.searchParams.set('search_radius', '10000');

    console.log('Calling DJI API:', djiUrl.toString());

    try {
        const response = await fetch(djiUrl.toString(), {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Prelude-Airspace-Map/1.0'
            },
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            console.error('DJI API HTTP error:', response.status);
            return res.status(502).json({ error: 'DJI API unavailable', status: response.status });
        }

        const data = await response.json();

        if (Number(data.status) !== 200) {
            console.error('DJI API error status:', data.status, 'msg:', data.extra?.msg);
            return res.status(502).json({ error: 'DJI API error', status: data.status, msg: data.extra?.msg });
        }

        const zones = data.extra?.areas || [];

        console.log('Zone count:', zones.length);
        if (zones.length > 0) {
            console.log('First zone:', JSON.stringify(zones[0], null, 2));
        }

        res.setHeader('Cache-Control', 'public, s-maxage=3600');

        return res.status(200).json({
            zones,
            count: zones.length,
            location: { lat: latitude, lng: longitude }
        });

    } catch (error) {
        console.error('Error:', error.message);
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            return res.status(504).json({ error: 'DJI API timed out' });
        }
        return res.status(500).json({ error: 'Failed to fetch airspace data', message: error.message });
    }
}
