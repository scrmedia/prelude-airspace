export default async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    let targetUrl;
    try {
        targetUrl = decodeURIComponent(url);
        new URL(targetUrl); // validate it's a proper URL
    } catch {
        return res.status(400).json({ error: 'Invalid url parameter' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(targetUrl, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            }
        });

        clearTimeout(timeout);

        const data = await response.json();

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.status(response.status).json(data);
    } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
            return res.status(504).json({ error: 'Request to DJI API timed out' });
        }
        return res.status(502).json({ error: 'Failed to fetch from DJI API' });
    }
}
