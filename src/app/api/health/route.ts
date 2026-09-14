import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Never cache — a health check must reflect the live state on every hit.
export const dynamic = 'force-dynamic';

/**
 * GET /api/health — lightweight liveness/readiness probe for uptime monitors,
 * load-balancer health checks, and status dashboards (Prometheus/Grafana, etc.).
 * Pings the database with a trivial query and reports 200 when reachable, 503
 * when not, so an unhealthy instance can be pulled from rotation automatically.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: 'ok', db: 'up', latencyMs: Date.now() - startedAt, time: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      { status: 'error', db: 'down', latencyMs: Date.now() - startedAt, time: new Date().toISOString() },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
