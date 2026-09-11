import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Clock, TrendingUp, FileText, Folder, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeSearchQuery } from '@/lib/security';
import { searchStaticArticles } from '@/lib/static-articles';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SearchResult {
  id: string;
  type: 'article' | 'project' | 'ai_tool';
  title: string;
  excerpt?: string;
  description?: string;
  slug?: string;
  url?: string;
  category?: string;
  tags?: string[];
  image_url?: string;
  rank?: number;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GlobalSearch = ({ open, onOpenChange }: GlobalSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Which result Enter would open. The footer has always promised "Enter to
  // select"; nothing implemented it, so a palette opened with Cmd+K could only
  // be finished with the mouse.
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // A new result set starts at the top, so Enter always opens the best match.
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  // Keep the highlighted row visible while arrowing through a long list.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Save search to recent searches
  const saveToRecent = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    const updated = [searchQuery, ...recentSearches.filter((s) => s !== searchQuery)].slice(0, 5); // Keep only 5 most recent

    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  // Clear recent searches
  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  // Perform search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    saveToRecent(searchQuery);

    try {
      // Skip search for very short queries (prevents expensive single-char DB queries)
      if (searchQuery.trim().length < 2) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      // Sanitize query for use in PostgREST filter expressions
      const sanitized = sanitizeSearchQuery(searchQuery);
      if (!sanitized) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      // Search articles with full-text search
      const { data: articles } = await supabase
        .from('articles')
        .select('id, title, excerpt, slug, category, tags, image_url')
        .eq('published', true)
        .or(`title.ilike.%${sanitized}%,excerpt.ilike.%${sanitized}%`)
        .limit(5);

      /*
       * Search projects.
       *
       * This query was broken and failing silently. It selected `slug` and
       * filtered on `published` — NEITHER COLUMN EXISTS on public.projects,
       * so PostgREST returned 400 ("column projects.slug does not exist") and
       * projects never appeared in search results at all. It went unnoticed
       * because only `data` was destructured: supabase-js reports this as an
       * `error` value rather than throwing, so the surrounding try/catch never
       * saw it and `projects?.map(...) || []` quietly yielded nothing.
       *
       * `error` is now read and logged so the next schema drift is visible.
       * The visibility filter matches Projects.tsx and is fail-open for the
       * same NULL-handling reason documented there.
       */
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, title, description, image_url')
        .or('status.is.null,status.neq.archived')
        .or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
        .limit(3);

      if (projectsError) logger.error('Project search failed:', projectsError);

      // Search AI tools
      const { data: aiTools } = await supabase
        .from('ai_tools')
        .select('id, title, description, category, link, image_url')
        .or(
          `title.ilike.%${sanitized}%,description.ilike.%${sanitized}%,category.ilike.%${sanitized}%`
        )
        .limit(3);

      // Prerendered articles with no database row yet never come back from the
      // query above; search them from the build-time index instead, minus any
      // slug the database already returned.
      const builtIn = searchStaticArticles(searchQuery, {
        limit: 5,
        excludeSlugs: (articles ?? []).map((a) => a.slug),
      });

      // Combine and format results
      const combined: SearchResult[] = [
        ...(articles?.map((a) => ({ ...a, type: 'article' as const })) || []),
        ...builtIn.map((a) => ({
          id: a.id,
          title: a.title,
          excerpt: a.excerpt ?? undefined,
          slug: a.slug,
          category: a.category ?? undefined,
          tags: a.tags ?? undefined,
          image_url: a.image_url ?? undefined,
          type: 'article' as const,
        })),
        ...(projects?.map((p) => ({ ...p, type: 'project' as const })) || []),
        ...(aiTools?.map((t) => ({ ...t, type: 'ai_tool' as const, url: t.link })) || []),
      ];

      setResults(combined);
    } catch (error) {
      logger.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'article' && result.slug) {
      navigate(`/news/${result.slug}`);
    } else if (result.type === 'project') {
      // public.projects has no `slug` column and there is no per-project route,
      // so this navigated to `/projects#undefined` — and in practice did
      // nothing at all, because the old `&& result.slug` guard could never be
      // satisfied. The list page is the real destination.
      navigate('/projects');
    } else if (result.type === 'ai_tool' && result.url) {
      window.open(result.url, '_blank');
    }
    onOpenChange(false);
    setQuery('');
  };

  // Handle recent search click
  const handleRecentClick = (recentQuery: string) => {
    setQuery(recentQuery);
  };

  // Arrow keys move the highlight, Enter opens it. Held in the input rather
  // than on each row so the caret never leaves the field while browsing.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(results.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const result = results[activeIndex] ?? results[0];
      if (result) handleResultClick(result);
    }
  };

  // Get icon for result type
  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'article':
        return <FileText className="w-4 h-4" />;
      case 'project':
        return <Folder className="w-4 h-4" />;
      case 'ai_tool':
        return <Wrench className="w-4 h-4" />;
    }
  };

  // Get type label
  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'article':
        return 'Article';
      case 'project':
        return 'Project';
      case 'ai_tool':
        return 'AI Tool';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85dvh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search articles, projects, AI tools..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-11 pr-11 h-12 text-lg border-none focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Search articles, projects, AI tools"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="global-search-results"
              aria-activedescendant={
                results.length > 0 ? `global-search-result-${activeIndex}` : undefined
              }
              autoComplete="off"
            />
            {query && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                onClick={() => setQuery('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="h-[min(60dvh,500px)]">
          <div className="px-6 py-4">
            {/* Loading state - skeleton cards that mirror the result rows */}
            {isLoading && (
              <div className="space-y-3" role="status" aria-label="Searching" aria-busy="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                    <Skeleton className="h-10 w-10 rounded-md shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
                <span className="sr-only">Searching…</span>
              </div>
            )}

            {/* No query - show recent searches */}
            {!query && recentSearches.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="w-4 h-4" />
                    Recent Searches
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearRecent} className="text-xs">
                    Clear
                  </Button>
                </div>
                <div className="space-y-2">
                  {recentSearches.map((recent, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleRecentClick(recent)}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors text-sm"
                    >
                      {recent}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No results */}
            {!isLoading && query && results.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No results found for "{query}"</p>
                <p className="text-sm mt-2">Try different keywords</p>
              </div>
            )}

            {/* Results */}
            {!isLoading && results.length > 0 && (
              <div className="space-y-1" ref={listRef}>
                <div className="flex items-center gap-2 text-sm font-medium mb-3" role="status">
                  <TrendingUp className="w-4 h-4" aria-hidden="true" />
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </div>
                <div id="global-search-results" role="listbox" aria-label="Search results">
                  {results.map((result, index) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      id={`global-search-result-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={index === activeIndex}
                      tabIndex={-1}
                      onClick={() => handleResultClick(result)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        'w-full text-left px-3 py-3 rounded-md transition-colors group',
                        index === activeIndex ? 'bg-accent' : 'hover:bg-accent'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {result.image_url && (
                          <img
                            src={result.image_url}
                            alt={result.title}
                            loading="lazy"
                            decoding="async"
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getIcon(result.type)}
                            <Badge variant="outline" className="text-xs">
                              {getTypeLabel(result.type)}
                            </Badge>
                            {result.category && (
                              <Badge variant="secondary" className="text-xs">
                                {result.category}
                              </Badge>
                            )}
                          </div>
                          <div className="font-medium mb-1 group-hover:text-primary transition-colors line-clamp-1">
                            {result.title}
                          </div>
                          {(result.excerpt || result.description) && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {result.excerpt || result.description}
                            </p>
                          )}
                          {result.tags && result.tags.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {result.tags.slice(0, 3).map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs px-2 py-0.5 bg-secondary rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t bg-muted/50 text-xs text-muted-foreground">
          <kbd className="px-2 py-1 bg-background rounded border">Esc</kbd> to close
          <span className="mx-2">·</span>
          <kbd className="px-2 py-1 bg-background rounded border">Up</kbd>
          <kbd className="ml-1 px-2 py-1 bg-background rounded border">Down</kbd> to move
          <span className="mx-2">·</span>
          <kbd className="px-2 py-1 bg-background rounded border">Enter</kbd> to select
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalSearch;
