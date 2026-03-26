// Vercel Serverless Function - Proxy for DJI FlySafe API
// Accepts lat/lng and calls DJI server-side to avoid CORS issues

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

    const { lat, lng } = req.query;

    if (!lat || !lng) {
        return res.status(400).json({ error: 'Missing required parameters: lat, lng' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const djiUrl = new URL('https://www-api.dji.com/api/geo/areas');
    djiUrl.searchParams.set('lat', latitude);
    djiUrl.searchParams.set('lng', longitude);
    djiUrl.searchParams.set('search_radius', '5000');
    djiUrl.searchParams.set('data_source', '0');
    djiUrl.searchParams.set('drone_type', '0');

    console.log('Proxying DJI request:', djiUrl.toString());

    try {
        const response = await fetch(djiUrl.toString(), {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Prelude-Airspace-Map/1.0'
            },
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            console.error('DJI API error:', response.status);
            return res.status(502).json({ error: 'DJI API unavailable', status: response.status });
        }

        const data = await response.json();

        console.log('DJI response: area count =', data.areas?.length || 0);

        res.setHeader('Cache-Control', 'public, s-maxage=3600');
        return res.status(200).json({
            zones: data.areas || [],
            count: data.areas?.length || 0,
            location: { lat: latitude, lng: longitude }
        });

    } catch (error) {
        console.error('Proxy error:', error.message);
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            return res.status(504).json({ error: 'DJI API timed out' });
        }
        return res.status(500).json({ error: 'Failed to fetch airspace data' });
    }
}
