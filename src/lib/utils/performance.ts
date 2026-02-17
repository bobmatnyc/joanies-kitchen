/**
 * Performance Monitoring Utilities
 *
 * Provides utilities for measuring and logging API performance:
 * - Function timing with automatic logging
 * - Slow query detection and alerts
 * - Performance metrics collection
 * - Optional performance budgets
 *
 * @example
 * ```typescript
 * import { measurePerformance, logSlowQuery } from '@/lib/utils/performance';
 *
 * const result = await measurePerformance(
 *   'searchRecipes',
 *   () => searchRecipesByIngredients(ingredients)
 * );
 * ```
 */

/**
 * Performance thresholds in milliseconds
 */
export const PERFORMANCE_THRESHOLDS = {
  /** API calls faster than this are considered excellent */
  EXCELLENT: 100,
  /** API calls faster than this are considered good */
  GOOD: 500,
  /** API calls slower than this are considered slow and will be logged */
  SLOW: 1000,
  /** API calls slower than this are considered critical and require attention */
  CRITICAL: 3000,
} as const;

/**
 * Performance budget targets for specific operations (in milliseconds)
 */
export const PERFORMANCE_BUDGETS = {
  autocomplete: 300, // Autocomplete must respond within 300ms
  recipeSearch: 1000, // Recipe search should complete within 1 second
  inventoryFetch: 200, // Inventory fetch should be quick
  pageLoad: 2000, // Initial page load target
} as const;

/**
 * Performance measurement result
 */
export interface PerformanceMeasurement {
  operation: string;
  duration: number;
  timestamp: number;
  isSlow: boolean;
  isCritical: boolean;
  withinBudget: boolean;
  budget?: number;
}

/**
 * Performance statistics
 */
interface PerformanceStats {
  operation: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  slowCount: number;
  criticalCount: number;
}

/**
 * In-memory performance metrics storage
 * Maps operation name to list of durations
 */
const performanceMetrics = new Map<string, number[]>();

/**
 * Maximum number of measurements to keep per operation
 */
const MAX_MEASUREMENTS = 100;

/**
 * Measure the execution time of an async function
 *
 * @param operation - Name of the operation being measured
 * @param fn - Async function to execute
 * @param budget - Optional performance budget in milliseconds
 * @returns Result of the function and performance measurement
 *
 * @example
 * ```typescript
 * const result = await measurePerformance(
 *   'searchRecipes',
 *   () => searchRecipesByIngredients(['chicken', 'rice']),
 *   1000 // 1 second budget
 * );
 * ```
 */
export async function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  budget?: number
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await fn();
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Record measurement
    recordMeasurement(operation, duration);

    // Check if slow
    const isSlow = duration > PERFORMANCE_THRESHOLDS.SLOW;
    const isCritical = duration > PERFORMANCE_THRESHOLDS.CRITICAL;
    const withinBudget = budget ? duration <= budget : true;

    // Log if slow or exceeds budget
    if (isSlow || !withinBudget) {
      logSlowQuery(operation, duration, budget);
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      const status = isCritical ? '🔴' : isSlow ? '🟡' : '🟢';
      console.log(
        `${status} [Performance] ${operation}: ${duration.toFixed(2)}ms${budget ? ` (budget: ${budget}ms)` : ''}`
      );
    }

    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Still record failed operations for metrics
    recordMeasurement(operation, duration);

    console.error(`[Performance] ${operation} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
}

/**
 * Measure the execution time of a synchronous function
 *
 * @param operation - Name of the operation being measured
 * @param fn - Function to execute
 * @param budget - Optional performance budget in milliseconds
 * @returns Result of the function
 */
export function measurePerformanceSync<T>(
  operation: string,
  fn: () => T,
  budget?: number
): T {
  const startTime = performance.now();

  try {
    const result = fn();
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Record measurement
    recordMeasurement(operation, duration);

    // Check if slow
    const isSlow = duration > PERFORMANCE_THRESHOLDS.SLOW;
    const withinBudget = budget ? duration <= budget : true;

    // Log if slow or exceeds budget
    if (isSlow || !withinBudget) {
      logSlowQuery(operation, duration, budget);
    }

    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    recordMeasurement(operation, duration);

    console.error(`[Performance] ${operation} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
}

/**
 * Log a slow query with details
 *
 * @param operation - Name of the slow operation
 * @param duration - Duration in milliseconds
 * @param budget - Optional performance budget that was exceeded
 */
export function logSlowQuery(operation: string, duration: number, budget?: number): void {
  const isCritical = duration > PERFORMANCE_THRESHOLDS.CRITICAL;
  const level = isCritical ? 'error' : 'warn';

  const budgetInfo = budget ? ` (budget: ${budget}ms, exceeded by ${(duration - budget).toFixed(2)}ms)` : '';

  console[level](
    `[Performance Alert] ${operation} took ${duration.toFixed(2)}ms${budgetInfo}`,
    {
      operation,
      duration: `${duration.toFixed(2)}ms`,
      threshold: `${PERFORMANCE_THRESHOLDS.SLOW}ms`,
      critical: isCritical,
      timestamp: new Date().toISOString(),
    }
  );
}

/**
 * Record a performance measurement
 *
 * @param operation - Name of the operation
 * @param duration - Duration in milliseconds
 */
function recordMeasurement(operation: string, duration: number): void {
  if (!performanceMetrics.has(operation)) {
    performanceMetrics.set(operation, []);
  }

  const measurements = performanceMetrics.get(operation)!;
  measurements.push(duration);

  // Keep only last N measurements
  if (measurements.length > MAX_MEASUREMENTS) {
    measurements.shift();
  }
}

/**
 * Get performance statistics for a specific operation
 *
 * @param operation - Name of the operation
 * @returns Performance statistics or null if no measurements exist
 */
export function getPerformanceStats(operation: string): PerformanceStats | null {
  const measurements = performanceMetrics.get(operation);

  if (!measurements || measurements.length === 0) {
    return null;
  }

  const count = measurements.length;
  const totalDuration = measurements.reduce((sum, d) => sum + d, 0);
  const avgDuration = totalDuration / count;
  const minDuration = Math.min(...measurements);
  const maxDuration = Math.max(...measurements);
  const slowCount = measurements.filter((d) => d > PERFORMANCE_THRESHOLDS.SLOW).length;
  const criticalCount = measurements.filter((d) => d > PERFORMANCE_THRESHOLDS.CRITICAL).length;

  return {
    operation,
    count,
    totalDuration,
    avgDuration,
    minDuration,
    maxDuration,
    slowCount,
    criticalCount,
  };
}

/**
 * Get performance statistics for all operations
 *
 * @returns Map of operation names to performance statistics
 */
export function getAllPerformanceStats(): Map<string, PerformanceStats> {
  const stats = new Map<string, PerformanceStats>();

  for (const operation of performanceMetrics.keys()) {
    const stat = getPerformanceStats(operation);
    if (stat) {
      stats.set(operation, stat);
    }
  }

  return stats;
}

/**
 * Log all performance statistics to console (development only)
 */
export function logPerformanceStats(): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const allStats = getAllPerformanceStats();

  if (allStats.size === 0) {
    console.log('[Performance Stats] No measurements recorded yet');
    return;
  }

  console.log('[Performance Stats]');
  console.table(
    Array.from(allStats.values()).map((stat) => ({
      Operation: stat.operation,
      Count: stat.count,
      'Avg (ms)': stat.avgDuration.toFixed(2),
      'Min (ms)': stat.minDuration.toFixed(2),
      'Max (ms)': stat.maxDuration.toFixed(2),
      'Slow %': ((stat.slowCount / stat.count) * 100).toFixed(1) + '%',
      'Critical %': ((stat.criticalCount / stat.count) * 100).toFixed(1) + '%',
    }))
  );
}

/**
 * Clear all performance metrics
 * Useful for resetting between test runs
 */
export function clearPerformanceMetrics(): void {
  performanceMetrics.clear();
}

/**
 * Simple timer utility for manual timing
 *
 * @example
 * ```typescript
 * const timer = startTimer();
 * // ... do work ...
 * const duration = timer.stop();
 * console.log(`Operation took ${duration}ms`);
 * ```
 */
export function startTimer() {
  const startTime = performance.now();

  return {
    /** Stop the timer and return elapsed time in milliseconds */
    stop: (): number => {
      return performance.now() - startTime;
    },
    /** Get elapsed time without stopping the timer */
    elapsed: (): number => {
      return performance.now() - startTime;
    },
  };
}

/**
 * Log performance statistics periodically in development
 * Call this once at app startup
 */
export function setupPerformanceLogging(intervalMs: number = 60000): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  setInterval(() => {
    logPerformanceStats();
  }, intervalMs);

  console.log(`[Performance] Logging enabled - stats will be printed every ${intervalMs / 1000}s`);
}
