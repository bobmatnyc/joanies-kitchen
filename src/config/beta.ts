// #62: single source of truth for the public beta launch date (G16 beta, 2027-02-01).
// Tests under test/ reference this constant; .mjs scripts that cannot import TS
// repeat the literal with a comment naming BETA_LAUNCH_DATE.
export const BETA_LAUNCH_DATE = '2027-02-01';

/** Formats an ISO date (YYYY-MM-DD) as M/D/YY, e.g. '2027-02-01' -> '2/1/27'. */
export function formatBetaLaunchDate(iso: string = BETA_LAUNCH_DATE): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${String(y).slice(-2)}`;
}
