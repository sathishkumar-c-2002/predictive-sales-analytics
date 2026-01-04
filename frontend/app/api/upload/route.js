// Next.js API Route - Proxy upload to backend
const BACKEND_URL = process.env.BACKEND_URL || 'https://predictive-sales-analytics.onrender.com';

export async function POST(request) {
    try {
        const formData = await request.formData();

        const res = await fetch(`${BACKEND_URL}/api/upload`, {
            method: 'POST',
            body: formData,
        });

        const data = await res.json();
        return Response.json(data, { status: res.status });
    } catch (error) {
        console.error('Upload proxy error:', error);
        return Response.json({ error: 'Failed to upload file' }, { status: 500 });
    }
}
