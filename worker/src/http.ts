export function allowedOrigin(origin: string | null, configured: string): string | null {
  if (!origin || configured.trim() === '*') return null;
  const allowed = configured.split(',').map((value) => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

export function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

export function json(body: Record<string, unknown>, status = 200, requestId: string = crypto.randomUUID(), origin: string | null = null): Response {
  const headers = corsHeaders(origin);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Request-Id', requestId);
  return new Response(JSON.stringify({ ...body, requestId }), { status, headers });
}

export function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get('Authorization') || '');
  return match?.[1] || null;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public code: string) {
    super(message);
  }
}
