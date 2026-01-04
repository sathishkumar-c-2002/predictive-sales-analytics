// Next.js API Route - Proxy metadata to backend
const BACKEND_URL = process.env.BACKEND_URL || 'https://predictive-sales-analytics.onrender.com';

export async function GET(request) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/metadata`);
        if (!res.ok) {
            return Response.json({ error: 'Metadata not found' }, { status: res.status });
        }
        const data = await res.json();
        return Response.json(data);
    } catch (error) {
        return Response.json({ error: 'Failed to fetch metadata' }, { status: 500 });
    }
}
