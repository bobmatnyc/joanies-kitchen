/**
 * Authentication Security Validator
 * Validates authentication implementation and identifies security issues
 */

import { authConfig } from '@/config/auth.config';

export interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  file?: string;
  line?: number;
  recommendation: string;
}

export class AuthSecurityValidator {
  private issues: SecurityIssue[] = [];

  /**
   * Run all security validations
   */
  public async validate(): Promise<SecurityIssue[]> {
    this.issues = [];

    this.validateEnvironmentConfiguration();
    this.validateClerkConfiguration();
    this.validateRouteProtection();
    this.validateApiSecurity();
    this.validateSessionManagement();
    this.validateCorsSettings();

    return this.issues;
  }

  /**
   * Validate environment configuration
   */
  private validateEnvironmentConfiguration(): void {
    // Check for exposed secrets
    if (process.env.CLERK_SECRET_KEY?.startsWith('pk_')) {
      this.addIssue({
        severity: 'critical',
        category: 'Configuration',
        message: 'Publishable key used as secret key',
        recommendation: 'Use the correct secret key (starts with sk_) for CLERK_SECRET_KEY',
      });
    }

    // Check for default/placeholder values
    if (process.env.CLERK_SECRET_KEY === 'YOUR_SECRET_KEY') {
      this.addIssue({
        severity: 'critical',
        category: 'Configuration',
        message: 'Default placeholder value used for secret key',
        recommendation: 'Configure actual Clerk keys from dashboard.clerk.com',
      });
    }

    // Warn about localhost authentication in production
    if (authConfig.allowLocalhostAuth && process.env.NODE_ENV === 'production') {
      this.addIssue({
        severity: 'high',
        category: 'Configuration',
        message: 'Localhost authentication enabled in production',
        recommendation: 'Set ALLOW_LOCALHOST_AUTH=false for production deployments',
      });
    }
  }

  /**
   * Validate Clerk-specific configuration
   */
  private validateClerkConfiguration(): void {
    // Check webhook endpoint security
    if (!process.env.WEBHOOK_SECRET && authConfig.enableClerk) {
      this.addIssue({
        severity: 'medium',
        category: 'Webhooks',
        message: 'Webhook secret not configured',
        recommendation: 'Configure WEBHOOK_SECRET for secure webhook validation',
      });
    }

    // Check for missing environment URLs
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      this.addIssue({
        severity: 'low',
        category: 'Configuration',
        message: 'App URL not configured',
        recommendation: 'Set NEXT_PUBLIC_APP_URL for proper OAuth redirects',
      });
    }

    // Validate OAuth callback URLs
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3004';
    const expectedCallback = `${appUrl}/.clerk/oauth_callback`;

    if (authConfig.enableClerk && appUrl.includes('localhost')) {
      this.addIssue({
        severity: 'medium',
        category: 'OAuth',
        message: 'Ensure localhost OAuth callback is configured in Clerk Dashboard',
        recommendation: `Add ${expectedCallback} to allowed redirect URLs in Clerk Dashboard`,
      });
    }
  }

  /**
   * Validate route protection
   */
  private validateRouteProtection(): void {
    // Check for unprotected sensitive routes
    const sensitiveRoutes = [
      '/admin',
      '/api/admin',
      '/api/users',
      '/settings',
    ];

    sensitiveRoutes.forEach(route => {
      if (!this.isRouteProtected(route)) {
        this.addIssue({
          severity: 'high',
          category: 'Route Protection',
          message: `Potentially sensitive route "${route}" is not protected`,
          recommendation: `Add "${route}" to protected routes in auth configuration`,
        });
      }
    });
  }

  /**
   * Validate API security
   */
  private validateApiSecurity(): void {
    // Check for CORS configuration
    if (!process.env.ALLOWED_ORIGINS && process.env.NODE_ENV === 'production') {
      this.addIssue({
        severity: 'medium',
        category: 'API Security',
        message: 'CORS origins not configured',
        recommendation: 'Configure ALLOWED_ORIGINS for production API security',
      });
    }

    // Check for rate limiting
    if (!authConfig.security.enableRateLimiting && process.env.NODE_ENV === 'production') {
      this.addIssue({
        severity: 'medium',
        category: 'API Security',
        message: 'Rate limiting disabled in production',
        recommendation: 'Enable rate limiting to prevent API abuse',
      });
    }
  }

  /**
   * Validate session management
   */
  private validateSessionManagement(): void {
    // Check session configuration
    if (!process.env.SESSION_SECRET && !authConfig.enableClerk) {
      this.addIssue({
        severity: 'high',
        category: 'Session',
        message: 'No session management configured',
        recommendation: 'Configure Clerk or implement custom session management',
      });
    }

    // Check for secure cookie settings in production
    if (process.env.NODE_ENV === 'production' && !authConfig.security.enforceHttps) {
      this.addIssue({
        severity: 'high',
        category: 'Session',
        message: 'HTTPS not enforced in production',
        recommendation: 'Enable HTTPS enforcement for secure cookie transmission',
      });
    }
  }

  /**
   * Validate CORS settings
   */
  private validateCorsSettings(): void {
    // Check for wildcard CORS in production
    if (process.env.ALLOWED_ORIGINS === '*' && process.env.NODE_ENV === 'production') {
      this.addIssue({
        severity: 'high',
        category: 'CORS',
        message: 'Wildcard CORS allowed in production',
        recommendation: 'Specify explicit allowed origins instead of wildcard',
      });
    }
  }

  /**
   * Helper to check if a route is protected
   */
  private isRouteProtected(route: string): boolean {
    return authConfig.routes.protected.some(pattern => {
      const regex = new RegExp(`^${pattern.replace(/\(\.\*\)/g, '.*')}$`);
      return regex.test(route);
    }) || authConfig.routes.apiProtected.some(pattern => {
      const regex = new RegExp(`^${pattern.replace(/\(\.\*\)/g, '.*')}$`);
      return regex.test(route);
    });
  }

  /**
   * Add a security issue to the list
   */
  private addIssue(issue: SecurityIssue): void {
    this.issues.push(issue);
  }

  /**
   * Get severity score for sorting
   */
  public static getSeverityScore(severity: SecurityIssue['severity']): number {
    const scores = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    return scores[severity];
  }
}

/**
 * Run security audit and return results
 */
export async function runSecurityAudit(): Promise<{
  status: 'APPROVED' | 'NEEDS_IMPROVEMENT' | 'BLOCKED';
  issues: SecurityIssue[];
  summary: string;
}> {
  const validator = new AuthSecurityValidator();
  const issues = await validator.validate();

  // Sort issues by severity
  issues.sort((a, b) =>
    AuthSecurityValidator.getSeverityScore(b.severity) -
    AuthSecurityValidator.getSeverityScore(a.severity)
  );

  // Determine overall status
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount = issues.filter(i => i.severity === 'high').length;

  let status: 'APPROVED' | 'NEEDS_IMPROVEMENT' | 'BLOCKED';
  if (criticalCount > 0) {
    status = 'BLOCKED';
  } else if (highCount > 0) {
    status = 'NEEDS_IMPROVEMENT';
  } else {
    status = 'APPROVED';
  }

  // Generate summary
  const summary = `Found ${issues.length} security issues: ${criticalCount} critical, ${highCount} high, ${issues.filter(i => i.severity === 'medium').length} medium, ${issues.filter(i => i.severity === 'low').length} low`;

  return { status, issues, summary };
}