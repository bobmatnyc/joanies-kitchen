/**
 * Week Utilities - Client-Safe Functions
 *
 * These utility functions are safe to import in client components
 * because they contain NO API keys or server-only code.
 */

export interface WeekInfo {
  year: number;
  week: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

/**
 * Calculates week information for a given number of weeks ago
 * Uses ISO week date system (week starts on Monday)
 *
 * @param weeksAgo - Number of weeks in the past (0 = current week)
 * @returns Week information including year, week number, and date range
 */
export function getWeekInfo(weeksAgo: number = 0): WeekInfo {
  const now = new Date();
  const targetDate = new Date(now.getTime() - (weeksAgo * 7 * 24 * 60 * 60 * 1000));

  // Get ISO week number
  const firstDayOfYear = new Date(targetDate.getFullYear(), 0, 1);
  const pastDaysOfYear = (targetDate.getTime() - firstDayOfYear.getTime()) / 86400000;
  const week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

  // Calculate start of week (Sunday)
  const dayOfWeek = targetDate.getDay();
  const startOfWeek = new Date(targetDate);
  startOfWeek.setDate(targetDate.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  // Calculate end of week (Saturday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return {
    year: targetDate.getFullYear(),
    week,
    startDate: startOfWeek.toISOString().split('T')[0],
    endDate: endOfWeek.toISOString().split('T')[0],
  };
}

/**
 * Format week information as a human-readable string
 *
 * @param weekInfo - Week information
 * @returns Formatted string (e.g., "Week 42, 2024 (Oct 14 - Oct 20)")
 */
export function formatWeekInfo(weekInfo: WeekInfo): string {
  const startDate = new Date(weekInfo.startDate);
  const endDate = new Date(weekInfo.endDate);

  const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
  const startDay = startDate.getDate();
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
  const endDay = endDate.getDate();

  return `Week ${weekInfo.week}, ${weekInfo.year} (${startMonth} ${startDay} - ${endMonth} ${endDay})`;
}
