import { NextResponse } from 'next/server';
import { authConfig } from '@/config/auth.config';
import { runSecurityAudit } from '@/lib/security/auth-validator';

export async function GET() {
  // Only allow in development or with admin auth
  if (process.env.NODE_ENV === 'production') {
    // In production, this should be protected by admin authentication
    return NextResponse.json({ error: 'Security audit disabled in production' }, { status: 403 });
  }

  try {
    const auditResults = await runSecurityAudit();

    const response = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      authConfig: {
        clerkEnabled: authConfig.enableClerk,
        localhostAuthEnabled: authConfig.allowLocalhostAuth,
        authRequired: authConfig.requireAuth,
        mockAuthEnabled: authConfig.useMockAuth,
      },
      audit: auditResults,
      recommendations: getPriorityRecommendations(auditResults.issues),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Security audit failed:', error);
    return NextResponse.json({ error: 'Failed to run security audit' }, { status: 500 });
  }
}

function getPriorityRecommendations(issues: any[]) {
  const recommendations = [];

  // Priority 1: Critical issues
  const critical = issues.filter((i) => i.severity === 'critical');
  if (critical.length > 0) {
    recommendations.push({
      priority: 1,
      action: 'Fix critical issues immediately',
      items: critical.map((i) => i.recommendation),
    });
  }

  // Priority 2: High issues
  const high = issues.filter((i) => i.severity === 'high');
  if (high.length > 0) {
    recommendations.push({
      priority: 2,
      action: 'Address high severity issues before production',
      items: high.map((i) => i.recommendation),
    });
  }

  // Priority 3: Medium issues
  const medium = issues.filter((i) => i.severity === 'medium');
  if (medium.length > 0) {
    recommendations.push({
      priority: 3,
      action: 'Implement medium severity fixes',
      items: medium.map((i) => i.recommendation),
    });
  }

  // Priority 4: Low issues
  const low = issues.filter((i) => i.severity === 'low');
  if (low.length > 0) {
    recommendations.push({
      priority: 4,
      action: 'Consider addressing low severity items',
      items: low.map((i) => i.recommendation),
    });
  }

  return recommendations;
}
