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
            console.error('DJI API HTTP error:', response.status, response.statusText);
            return res.status(502).json({ error: 'DJI API unavailable', status: response.status });
        }

        const data = await response.json();

        console.log('Full DJI response:', JSON.stringify(data, null, 2));

        let zones = [];

        if (data.areas && Array.isArray(data.areas)) {
            zones = data.areas;
        } else if (data.zones && Array.isArray(data.zones)) {
            zones = data.zones;
        } else if (data.data && Array.isArray(data.data)) {
            zones = data.data;
        } else if (Array.isArray(data)) {
            zones = data;
        } else {
            console.log('Unknown response structure, keys:', Object.keys(data));
        }

        if (zones.length > 0) {
            console.log('First zone structure:', JSON.stringify(zones[0], null, 2));
        }

        res.setHeader('Cache-Control', 'public, s-maxage=3600');

        return res.status(200).json({
            zones: zones,
            count: zones.length,
            location: { lat: latitude, lng: longitude },
            raw: data
        });

    } catch (error) {
        console.error('Error calling DJI API:', error.message);

        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            return res.status(504).json({ error: 'DJI API timed out' });
        }

        return res.status(500).json({ error: 'Failed to fetch airspace data', message: error.message });
    }
}
