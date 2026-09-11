import { useEffect, useMemo, useState } from 'react';
import { List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractHeadings } from '@/lib/markdown-headings';
import { useIsMobile } from '@/hooks/use-mobile';

interface TableOfContentsProps {
  /** The article's markdown source. */
  content: string;
  /** Below this many sections a contents list is noise rather than help. */
  minimumSections?: number;
}

/**
 * A contents panel for long articles.
 *
 * Built from the markdown source rather than the rendered DOM, so it appears
 * with the article instead of a frame later, and its links use the same ids
 * MarkdownRenderer puts on the headings.
 *
 * It is a <details> so a phone gets a collapsed summary rather than a screenful
 * of links above the first paragraph; on a wider screen it starts open.
 */
const TableOfContents = ({ content, minimumSections = 4 }: TableOfContentsProps) => {
  const isMobile = useIsMobile();
  const sections = useMemo(
    () => extractHeadings(content).filter((heading) => heading.level === 2 || heading.level === 3),
    [content]
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (sections.length < minimumSections) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    // The heading nearest the top of the viewport wins, so the marker tracks
    // what the reader is looking at rather than whatever entered last.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -70% 0px' }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sections, minimumSections]);

  if (sections.length < minimumSections) return null;

  return (
    <details
      open={!isMobile}
      className="my-8 rounded-xl border border-border bg-card/50 p-4 sm:p-5"
    >
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground marker:content-['']">
        <List className="h-4 w-4 text-primary" aria-hidden="true" />
        Contents
      </summary>

      <nav aria-label="Article contents" className="mt-4">
        <ol className="space-y-1">
          {sections.map((section) => (
            <li key={section.id} className={section.level === 3 ? 'ml-4' : undefined}>
              <a
                href={`#${section.id}`}
                aria-current={activeId === section.id ? 'location' : undefined}
                className={cn(
                  'block rounded px-2 py-1 text-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  activeId === section.id ? 'text-primary font-medium' : 'text-muted-foreground'
                )}
              >
                {section.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
};

export default TableOfContents;
