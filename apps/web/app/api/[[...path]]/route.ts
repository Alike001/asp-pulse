import { handleVercelApi } from '@/lib/server-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  return handleVercelApi(request)
}

export async function HEAD(request: Request): Promise<Response> {
  return handleVercelApi(request)
}

export async function POST(request: Request): Promise<Response> {
  return handleVercelApi(request)
}

export async function DELETE(request: Request): Promise<Response> {
  return handleVercelApi(request)
}

export async function OPTIONS(request: Request): Promise<Response> {
  return handleVercelApi(request)
}
