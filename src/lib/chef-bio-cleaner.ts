/**
 * Chef bio cleaner.
 *
 * Why: chef discovery stored the first 500 characters of a scraped About page
 * as the bio when no LLM summary was available. Those characters are mostly
 * site chrome — navigation, social links, newsletter promos — not prose.
 * What: deterministic, pure functions. `cleanScrapedBio` keeps only
 * sentence-like prose lines and returns them bounded to `MAX_BIO_LENGTH`, or
 * '' when no prose survives. `bioNeedsRepair` says whether a stored bio would
 * change under the cleaner.
 * Test: `src/lib/__tests__/chef-bio-cleaner.test.ts`
 */

/** Shortest cleaned bio worth storing; anything shorter becomes ''. */
export const MIN_BIO_LENGTH = 60;
/** Longest cleaned bio; longer prose is cut at a sentence boundary. */
export const MAX_BIO_LENGTH = 1000;
/** A prose line has at least this many words. */
const MIN_PROSE_WORDS = 8;

const SOCIAL =
  /\b(instagram|facebook|pinterest|twitter|tiktok|youtube|linkedin|snapchat|substack)\b/i;
const PROMO =
  /\b(subscribe|newsletter|sign ?up|log ?in|sign ?in|my account|cart|checkout|shop now|buy now|free (e-?book|guide|download)|download|cookie (policy|settings|preferences)|we use cookies|privacy policy|terms (of|&) (use|service)|all rights reserved|copyright|skip to (main )?content|jump to recipe|follow (me|us)|join (the|my|our)|get (the|my|our) (latest|free)|affiliate|disclosure|as an amazon associate)\b|©/i;
const URL = /https?:\/\/|www\.|\S+\.(com|net|org|co|io|de)\b/i;
const SENTENCE_END = /[.!?]["')\]]?$/;

/** Removes markdown images, keeps link text, drops bare URLs and emphasis marks. */
function stripMarkdown(line: string): string {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Counts markdown links in the raw line; a line made of links is a link list. */
function linkCount(line: string): number {
  return (line.match(/\]\([^)]*\)/g) ?? []).length;
}

/** True when a raw page line is prose and not chrome. */
function isProseLine(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  // Headings, list items, table rows, block quotes and rules are layout, not bio prose.
  if (/^(#{1,6}\s|[-*+]\s|\d+[.)]\s|\||>|={3,}|-{3,})/.test(trimmed)) return false;
  if (linkCount(trimmed) >= 2) return false;

  const text = stripMarkdown(trimmed);
  if (URL.test(text) || SOCIAL.test(text) || PROMO.test(text)) return false;

  const words = text.split(' ').filter((w) => /[a-z]/i.test(w));
  if (words.length < MIN_PROSE_WORDS) return false;
  if (!SENTENCE_END.test(text)) return false;
  // Mostly letters: rejects price lists, dates and symbol runs.
  const letters = (text.match(/[a-z]/gi) ?? []).length;
  return letters / text.length >= 0.6;
}

/** Cuts text to at most `max` characters at the last sentence end inside the bound. */
function boundToSentences(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const cut = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  return cut > 0 ? head.slice(0, cut + 1) : '';
}

/**
 * Returns the prose of a scraped page or bio, or '' when it holds none.
 * Never returns a line that failed `isProseLine`.
 */
export function cleanScrapedBio(input: string | null | undefined): string {
  if (!input) return '';
  const prose = input
    .split(/\r?\n/)
    .filter(isProseLine)
    .map(stripMarkdown)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const bounded = boundToSentences(prose, MAX_BIO_LENGTH);
  return bounded.length >= MIN_BIO_LENGTH ? bounded : '';
}

/** True when a stored bio is non-empty and the cleaner would change it. */
export function bioNeedsRepair(bio: string | null | undefined): boolean {
  if (!bio?.trim()) return false;
  return cleanScrapedBio(bio) !== bio.replace(/\s+/g, ' ').trim();
}
