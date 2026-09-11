/**
 * Heading extraction shared by the markdown renderer and the contents panel.
 *
 * Both have to agree on the id of a heading exactly, or every contents link is
 * a dead anchor, so the slug rule and the duplicate counter live here rather
 * than in either consumer.
 */

export interface MarkdownHeading {
  /** 1 for `#`, 2 for `##`, and so on. */
  level: number;
  /** The heading as written, with any inline markup stripped. */
  text: string;
  /** The fragment the renderer puts on the element. */
  id: string;
}

/**
 * Turns the text of a heading into a URL fragment: lowercase, words joined by
 * hyphens, anything else dropped. Matches how GitHub and most markdown
 * renderers slug headings, so links written against those conventions land.
 */
export function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Gives out ids for one article, appending -2, -3 and so on to repeats. The
 * renderer creates one of these per render pass, so a heading keeps its id
 * across re-renders.
 */
export function createHeadingIds(): (text: string) => string | undefined {
  const used = new Map<string, number>();

  return (text: string) => {
    const base = headingSlug(text);
    if (!base) return undefined;

    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    return seen === 0 ? base : `${base}-${seen + 1}`;
  };
}

/** Inline markup that would otherwise end up in a heading's text. */
function stripInlineMarkup(text: string): string {
  return text
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .trim();
}

/**
 * Reads the headings out of markdown source, in document order.
 *
 * Source rather than the rendered DOM, so a contents panel can render with the
 * article instead of after it. Fenced code blocks are skipped: a `#` comment in
 * a shell snippet is not a heading. Duplicate ids are numbered exactly as the
 * renderer numbers them, counting every level, so filtering the result to h2
 * and h3 still yields ids that match the page.
 */
export function extractHeadings(markdown: string): MarkdownHeading[] {
  const nextId = createHeadingIds();
  const headings: MarkdownHeading[] = [];
  let fence: string | null = null;

  for (const line of markdown.split('\n')) {
    const fenceMatch = line.match(/^\s{0,3}(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (fence !== null) continue;

    const match = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (!match) continue;

    const text = stripInlineMarkup(match[2]);
    const id = nextId(text);
    if (!id) continue;

    headings.push({ level: match[1].length, text, id });
  }

  return headings;
}
