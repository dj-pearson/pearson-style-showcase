/**
 * Quality gate for machine-written articles.
 *
 * Both daily pipelines publish without a human in the loop, so this is the
 * last check between a model's output and a public URL. It is deliberately
 * mechanical: it cannot tell whether an argument is good, but it can tell
 * whether the article has the structure the prerenderer turns into schema,
 * whether a link points somewhere the pipeline never gave the model, and
 * whether the prose has slid into the register the house style bans.
 *
 * An article that fails a blocking check is saved as a draft rather than
 * thrown away, so the run still produces something an editor can fix.
 *
 * Pure: no Deno globals, no imports. Unit-tested in __tests__.
 */

export interface QualityIssue {
  code: string;
  message: string;
  blocking: boolean;
}

export interface QualityReport {
  ok: boolean;
  wordCount: number;
  issues: QualityIssue[];
}

/**
 * Words and phrases the house style bans outright (CLAUDE.md, "Write like a
 * person"). One slip is a warning; a cluster means the model ignored the
 * brief, and that is blocking.
 */
export const BANNED_TERMS = [
  'delve',
  'dive into',
  'deep dive',
  'unpack',
  'shed light on',
  'pave the way',
  'usher in',
  'tap into',
  'supercharge',
  'unlock',
  'elevate',
  'empower',
  'streamline',
  'game-changing',
  'game changer',
  'groundbreaking',
  'cutting-edge',
  'transformative',
  'innovative',
  'pivotal',
  'invaluable',
  'meticulous',
  'bespoke',
  'vibrant',
  'multifaceted',
  'holistic',
  'testament',
  'tapestry',
  'synergy',
  'cornerstone',
  'treasure trove',
  'plethora',
  'myriad',
  'moreover',
  'furthermore',
  'additionally',
  "in today's",
  "it's important to note",
  "it's worth noting",
  'when it comes to',
  'at its core',
  'at the end of the day',
  'plays a crucial role',
  'cannot be overstated',
  "let's break it down",
];

/**
 * Invisible and bidi-control characters. They render as nothing, survive
 * review, and have no business in generated prose. The tag block
 * (U+E0000-U+E007F) can carry hidden text, so it goes too.
 */
const INVISIBLE =
  /[\u00AD\u034F\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]|\uDB40[\uDC00-\uDC7F]/g;

export function stripInvisible(text: string): string {
  return text.replace(INVISIBLE, '').replace(/[\u00A0\u202F\u2007\u2009\u2002\u2003\u3000]/g, ' ');
}

/** Words in a markdown body, ignoring link targets, markup and table rules. */
export function countWords(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>|[\]-]+/g, ' ')
    .trim();
  return text ? text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length : 0;
}

export function readTime(markdown: string): string {
  return `${Math.max(1, Math.ceil(countWords(markdown) / 220))} min read`;
}

/** URL-friendly slug, capped so the full URL stays readable in a SERP. */
export function slugify(title: string, maxLength = 80): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (slug.length <= maxLength) return slug;
  // Cut on a word boundary so the slug never ends mid-word.
  const cut = slug.slice(0, maxLength);
  return cut.slice(0, cut.lastIndexOf('-') > 20 ? cut.lastIndexOf('-') : maxLength);
}

/** Drop tracking parameters, fragments and trailing slashes for comparison. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(key)) u.searchParams.delete(key);
    }
    u.hostname = u.hostname.replace(/^www\./, '');
    return u.toString().replace(/\/+$/, '').replace(/\?$/, '');
  } catch {
    return url.trim();
  }
}

/**
 * Replace every markdown link whose target the pipeline did not supply with
 * its plain text. A model asked to cite sources will otherwise invent
 * plausible URLs, and a 404 citation costs more trust than no citation.
 *
 * Internal links (starting with "/") pass only when their path is in
 * `allowedPaths`, for the same reason.
 */
export function restrictLinks(
  markdown: string,
  allowedUrls: Iterable<string>,
  allowedPaths: Iterable<string> = []
): { content: string; removed: string[] } {
  const urls = new Set([...allowedUrls].map(normalizeUrl));
  const paths = new Set(allowedPaths);
  const removed: string[] = [];

  const content = markdown.replace(
    /(!?)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
    (whole, bang: string, text: string, target: string) => {
      if (bang) return whole; // images are handled by the caller
      const ok = target.startsWith('/')
        ? paths.has(target.split(/[?#]/)[0])
        : urls.has(normalizeUrl(target));
      if (ok) return whole;
      removed.push(target);
      return text;
    }
  );

  return { content, removed };
}

/** Remove a trailing section by heading, so the pipeline can write its own. */
export function removeSection(markdown: string, heading: RegExp): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => /^#{2,3}\s/.test(line) && heading.test(line));
  if (start === -1) return markdown;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return [...lines.slice(0, start), ...lines.slice(end)]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Number of FAQ entries under the house "## Frequently asked questions" heading. */
export function countFaqs(markdown: string): number {
  const section = markdown.match(/(?:^|\n)##\s+Frequently asked[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (!section) return 0;
  return (section[1].match(/(?:^|\n)\*\*[^*\n]+\?\*\*\s*\n/g) || []).length;
}

export function findBannedTerms(text: string): string[] {
  const lower = text.toLowerCase().replace(/[\u2018\u2019]/g, "'");
  return BANNED_TERMS.filter((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z])${escaped}`, 'i').test(lower);
  });
}

export interface ArticleDraft {
  title: string;
  content: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
}

export interface QualityRules {
  minWords: number;
  maxWords: number;
  /** H2 headings (matched case-insensitively by prefix) the article must carry. */
  requiredHeadings: string[];
  minFaqs: number;
}

export function checkArticle(draft: ArticleDraft, rules: QualityRules): QualityReport {
  const issues: QualityIssue[] = [];
  const add = (code: string, message: string, blocking: boolean) =>
    issues.push({ code, message, blocking });

  const wordCount = countWords(draft.content);
  if (wordCount < rules.minWords) {
    add('too_short', `${wordCount} words, minimum is ${rules.minWords}`, true);
  }
  if (wordCount > rules.maxWords) {
    add('too_long', `${wordCount} words, maximum is ${rules.maxWords}`, false);
  }

  const headings = (draft.content.match(/^##\s+.+$/gm) || []).map((h) =>
    h.replace(/^##\s+/, '').toLowerCase()
  );
  for (const required of rules.requiredHeadings) {
    if (!headings.some((h) => h.startsWith(required.toLowerCase()))) {
      add('missing_section', `No "## ${required}" section`, true);
    }
  }

  const faqs = countFaqs(draft.content);
  if (faqs < rules.minFaqs) {
    add('few_faqs', `${faqs} FAQ entries, minimum is ${rules.minFaqs}`, true);
  }

  if (!draft.title || draft.title.length > 80) {
    add('title_length', `Title is ${draft.title?.length ?? 0} characters`, true);
  }
  if (draft.seoTitle.length > 65) {
    add('seo_title_length', `SEO title is ${draft.seoTitle.length} characters`, false);
  }
  if (draft.seoDescription.length < 70 || draft.seoDescription.length > 170) {
    add(
      'seo_description_length',
      `Meta description is ${draft.seoDescription.length} characters`,
      false
    );
  }
  if (!draft.excerpt || draft.excerpt.length < 40) {
    add('excerpt_missing', 'Excerpt is missing or too short', true);
  }

  if (/\{\{|\}\}|\[object Object\]|PLACEHOLDER|lorem ipsum/i.test(draft.content)) {
    add('template_leak', 'Content contains an unfilled placeholder', true);
  }
  if (/^#\s/m.test(draft.content)) {
    add('h1_in_body', 'Body contains an H1; the page title is the only H1', false);
  }

  const banned = findBannedTerms(`${draft.title}\n${draft.excerpt}\n${draft.content}`);
  if (banned.length) {
    add('banned_terms', `House-style banned terms: ${banned.join(', ')}`, banned.length >= 3);
  }

  return { ok: !issues.some((i) => i.blocking), wordCount, issues };
}
