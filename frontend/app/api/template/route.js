// Next.js API Route - Download template from backend
const BACKEND_URL = process.env.BACKEND_URL || 'https://predictive-sales-analytics.onrender.com';

export async function GET(request) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/template`);

        if (!res.ok) {
            return Response.json({ error: 'Template not found' }, { status: 404 });
        }

        const blob = await res.blob();

        return new Response(blob, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename="sales_data_template.csv"',
            },
        });
    } catch (error) {
        return Response.json({ error: 'Failed to fetch template' }, { status: 500 });
    }
}
