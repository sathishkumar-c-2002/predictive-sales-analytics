// Next.js API Route - Proxy upload to backend
const BACKEND_URL = process.env.BACKEND_URL || 'https://predictive-sales-analytics.onrender.com';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        // Get the raw body as ArrayBuffer
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return Response.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // Create a new FormData to send to backend
        const backendFormData = new FormData();
        backendFormData.append('file', file);

        const res = await fetch(`${BACKEND_URL}/api/upload`, {
            method: 'POST',
            body: backendFormData,
        });

        const data = await res.json();
        return Response.json(data, { status: res.status });
    } catch (error) {
        console.error('Upload proxy error:', error);
        return Response.json({
            error: 'Failed to upload file',
            details: error.message
        }, { status: 500 });
    }
}
