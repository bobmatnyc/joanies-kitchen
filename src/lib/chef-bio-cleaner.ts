/**
 * Chef bio cleaner.
 *
 * Why: chef discovery stored the first 500 characters of a scraped About page
 * as the bio when no LLM summary was available. Those characters are mostly
 * site chrome — navigation, social links, newsletter promos — not prose.
 * What: deterministic, pure functions. `cleanScrapedBio` keeps only
 * sentence-like prose lines, minus chrome sentences (promos, URLs, short
 * social labels), and returns them bounded to `MAX_BIO_LENGTH`, or
 * '' when no prose survives. `bioNeedsRepair` says whether a stored bio would
 * change under the cleaner.
 * Test: `src/lib/__tests__/chef-bio-cleaner.test.ts`
 */

/** Shortest cleaned bio worth storing; anything shorter becomes ''. */
export const MIN_BIO_LENGTH = 30;
/** Longest cleaned bio; longer prose is cut at a sentence boundary. */
export const MAX_BIO_LENGTH = 1000;
/** A prose line has at least this many words. */
const MIN_PROSE_WORDS = 5;
/** A sentence naming a social network with fewer words than this is a link label, not prose. */
const SOCIAL_FRAGMENT_WORDS = 8;

const SOCIAL =
  /\b(instagram|facebook|pinterest|twitter|tiktok|youtube|linkedin|snapchat|substack)\b/i;
const PROMO =
  /\b(subscribe|newsletter|sign ?up|log ?in|sign ?in|my account|cart|checkout|shop now|buy now|free (e-?book|guide|download)|download|cookie (policy|settings|preferences)|we use cookies|privacy policy|terms (of|&) (use|service)|all rights reserved|copyright|skip to (main )?content|jump to recipe|follow (me|us)|join (my|our) (newsletter|community|mailing list)|get (the|my|our) (latest|free)|affiliate|disclosure|as an amazon associate)\b|©/i;
// A domain is a dotted token with no space after the dot, so sentence ends never match.
// Error, bot-block, consent, analytics and accessibility-widget notices that scraping captures as prose.
// Words that also occur in bio prose (blocked, analytics, tracking, javascript,
// learn more, contact us, try again) match only inside notice wording. A bio
// sentence such as "Contact us for catering inquiries" is kept.
const BOILERPLATE =
  /\b(something went wrong|(wait a moment|please|an error occurred|error)\W.*\btry (again|refreshing)|try (again|refreshing) (later|the page)|refresh(ing)? the page|you (have been|are|were) blocked|blocked (by|in error|from accessing this)|access (has been )?denied|click (here|the (link|button))\b.*\bcontact us|click the (link|button)|learn more (here|about (our|how we|cookies|your privacy))|click here to learn more|opt[- ]out|personal (information|data)|targeted advertising|we value your privacy|analytics (tool|cookies|tracking|services|providers?)|we use [^.]*analytics|tracking (cookies|technolog(y|ies)|pixels?)|audioeye|accessibility (options|toolbar)|assistive technolog(y|ies)|keystroke|(enable|requires?|turn on|activate) javascript|javascript (is )?(disabled|required)|enable cookies|your browser)\b/i;
const URL = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|de|co\.uk)(\/|\b)/i;
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

function wordCount(text: string): number {
  return text.split(' ').filter((w) => /[a-z]/i.test(w)).length;
}

/**
 * True when a raw page line can hold bio prose. Layout lines (headings, list
 * items, tables, rules), link lists and lines with no sentence end are chrome.
 */
function isProseLine(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^(#{1,6}\s|[-*+]\s|\d+[.)]\s|\||>|={3,}|-{3,})/.test(trimmed)) return false;
  if (linkCount(trimmed) >= 2) return false;
  const text = stripMarkdown(trimmed);
  if (wordCount(text) < MIN_PROSE_WORDS || !SENTENCE_END.test(text)) return false;
  // Mostly letters: rejects price lists, dates and symbol runs.
  const letters = (text.match(/[a-z]/gi) ?? []).length;
  return letters / text.length >= 0.6;
}

/**
 * True when one sentence is chrome: a promo or call to action, a site notice
 * (error, block, consent, analytics, accessibility widget), a URL, or a
 * short social-network label ("Follow along on Instagram!"). A full sentence
 * that merely names a network is prose and is kept.
 */
function isChromeSentence(sentence: string): boolean {
  if (PROMO.test(sentence) || BOILERPLATE.test(sentence) || URL.test(sentence)) return true;
  return SOCIAL.test(sentence) && wordCount(sentence) < SOCIAL_FRAGMENT_WORDS;
}

/** Drops chrome sentences from a prose line; keeps the rest verbatim. */
function proseSentences(line: string): string {
  return line
    .split(/(?<=[.!?]["')\]]?)\s+(?=["'(]?[A-Z0-9])/)
    .filter((sentence) => !isChromeSentence(sentence))
    .join(' ');
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
 * Never returns a line that failed `isProseLine` or a sentence that
 * `isChromeSentence` flags.
 */
export function cleanScrapedBio(input: string | null | undefined): string {
  if (!input) return '';
  const prose = input
    .split(/\r?\n/)
    .filter(isProseLine)
    .map((line) => proseSentences(stripMarkdown(line)))
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
