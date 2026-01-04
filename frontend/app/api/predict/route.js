// Next.js API Route - Proxy predict to backend
const BACKEND_URL = process.env.BACKEND_URL || 'https://predictive-sales-analytics.onrender.com';

export async function POST(request) {
    try {
        const body = await request.json();

        const res = await fetch(`${BACKEND_URL}/api/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await res.json();
        return Response.json(data, { status: res.status });
    } catch (error) {
        console.error('Predict proxy error:', error);
        return Response.json({ error: 'Failed to get prediction' }, { status: 500 });
    }
}
