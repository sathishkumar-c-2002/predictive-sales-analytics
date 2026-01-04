// Next.js API Route - Proxy to backend
const BACKEND_URL = process.env.BACKEND_URL || 'https://predictive-sales-analytics.onrender.com';

export async function GET(request) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/sales`);
        const data = await res.json();
        return Response.json(data);
    } catch (error) {
        return Response.json({ error: 'Failed to fetch sales data' }, { status: 500 });
    }
}
