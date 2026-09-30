import { GET as generatePdf } from '../pdf/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return generatePdf(request, context);
}
