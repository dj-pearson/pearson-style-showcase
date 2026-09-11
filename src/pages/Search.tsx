import LoadingSpinner from '@/components/LoadingSpinner';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import {
  Search as SearchIcon,
  TrendingUp,
  FileText,
  Folder,
  Wrench,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeSearchQuery } from '@/lib/security';
import { searchStaticArticles } from '@/lib/static-articles';
import { logger } from '@/lib/logger';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

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
}

// Ordering weights: an exact title hit should always beat a body-text hit,
// and within the same weight articles come before projects and tools.
const TYPE_ORDER: Record<SearchResult['type'], number> = {
  article: 0,
  project: 1,
  ai_tool: 2,
};

function relevanceScore(result: SearchResult, needle: string): number {
  const title = result.title?.toLowerCase() ?? '';
  if (title === needle) return 0;
  if (title.startsWith(needle)) return 1;
  if (title.includes(needle)) return 2;
  if (result.tags?.some((tag) => tag.toLowerCase().includes(needle))) return 3;
  const body = (result.excerpt || result.description || '').toLowerCase();
  if (body.includes(needle)) return 4;
  return 5;
}

export function sortByRelevance(results: SearchResult[], needle: string): SearchResult[] {
  return [...results].sort((a, b) => {
    const diff = relevanceScore(a, needle) - relevanceScore(b, needle);
    return diff !== 0 ? diff : TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  });
}

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState((searchParams.get('q') || '').trim().substring(0, 200));
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Monotonic id for the in-flight search. A slow earlier query must never
  // overwrite the results of a later one.
  const latestRequest = useRef(0);

  // Update query from URL parameter (with length bounds)
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery) {
      setQuery(urlQuery.trim().substring(0, 200));
    }
  }, [searchParams]);

  // Perform search when query changes
  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      const requestId = ++latestRequest.current;
      setIsLoading(true);

      try {
        // Skip search for very short queries (prevents expensive single-char DB queries)
        if (query.trim().length < 2) {
          setResults([]);
          setIsLoading(false);
          return;
        }

        // Sanitize query for use in PostgREST filter expressions
        const sanitized = sanitizeSearchQuery(query);
        if (!sanitized) {
          setResults([]);
          setIsLoading(false);
          return;
        }

        // Search articles with full-text search
        const { data: articles, error: articlesError } = await supabase
          .from('articles')
          .select('id, title, excerpt, slug, category, tags, image_url')
          .eq('published', true)
          .or(
            `title.ilike.%${sanitized}%,excerpt.ilike.%${sanitized}%,content.ilike.%${sanitized}%`
          )
          .limit(10);

        if (articlesError) logger.error('Search articles query failed:', articlesError);

        // Search projects.
        // NOTE: the projects table has no `published` or `slug` column (it uses
        // `status`). The public Projects page shows all projects regardless of
        // status, so search does the same for consistency and navigates via an
        // id-based anchor (#project-<id>).
        const { data: projects, error: projectsError } = await supabase
          .from('projects')
          .select('id, title, description, image_url')
          .or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
          .limit(5);

        if (projectsError) logger.error('Search projects query failed:', projectsError);

        // Search AI tools
        const { data: aiTools, error: aiToolsError } = await supabase
          .from('ai_tools')
          .select('id, title, description, category, link, image_url')
          .or(
            `title.ilike.%${sanitized}%,description.ilike.%${sanitized}%,category.ilike.%${sanitized}%`
          )
          .limit(5);

        if (aiToolsError) logger.error('Search ai_tools query failed:', aiToolsError);

        // Articles that are prerendered but have no database row yet are
        // invisible to the query above, so search them from the build-time
        // index and drop any slug the database already returned.
        const builtIn = searchStaticArticles(query, {
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

        if (requestId !== latestRequest.current) return;
        setResults(sortByRelevance(combined, query.trim().toLowerCase()));
      } catch (error) {
        logger.error('Search error:', error);
        if (requestId === latestRequest.current) setResults([]);
      } finally {
        if (requestId === latestRequest.current) setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Keep ?q= in step with what has been typed, so a result list can be
  // shared, bookmarked, or reached again with the back button.
  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(() => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (trimmed) {
            if (next.get('q') === trimmed) return next;
            next.set('q', trimmed);
          } else {
            if (!next.has('q')) return next;
            next.delete('q');
          }
          return next;
        },
        { replace: true }
      );
    }, 400);

    return () => clearTimeout(timer);
  }, [query, setSearchParams]);

  // Handle search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query });
    }
  };

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'article' && result.slug) {
      navigate(`/news/${result.slug}`);
    } else if (result.type === 'project') {
      navigate(`/projects#project-${result.id}`);
    } else if (result.type === 'ai_tool' && result.url) {
      window.open(result.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Get icon for result type
  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'article':
        return <FileText className="w-5 h-5" aria-hidden="true" />;
      case 'project':
        return <Folder className="w-5 h-5" aria-hidden="true" />;
      case 'ai_tool':
        return <Wrench className="w-5 h-5" aria-hidden="true" />;
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
    <div className="min-h-screen flex flex-col">
      <SEO
        title={query ? `Search Results for "${query}" | Dan Pearson` : 'Search | Dan Pearson'}
        description={
          query
            ? `Search results for ${query} across articles, projects, and AI tools on Dan Pearson's portfolio.`
            : "Search across articles, projects, and AI tools on Dan Pearson's portfolio."
        }
        url={`https://danpearson.net/search${query ? `?q=${encodeURIComponent(query)}` : ''}`}
        type="website"
        noIndex={true}
      />

      <Navigation />

      <main id="main-content" className="flex-1 pt-20 px-4 md:px-6">
        <div className="container mx-auto max-w-4xl">
          {/* Back Button */}
          <div className="mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>

          {/* Search Header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Search</h1>
            <p className="text-lg text-muted-foreground">
              Search across articles, projects, and AI tools
            </p>
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearch} className="mb-8">
            <div className="relative">
              <SearchIcon
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground"
                aria-hidden="true"
              />
              <label htmlFor="search-input" className="sr-only">
                Search for articles, projects, AI tools
              </label>
              <Input
                id="search-input"
                type="text"
                placeholder="Search for articles, projects, AI tools..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-12 h-14 text-lg"
                autoFocus
                aria-label="Search for articles, projects, AI tools"
              />
            </div>
          </form>

          {/* Results Section */}
          <div className="mb-16">
            {/* Loading state */}
            {isLoading && (
              <div className="text-center py-12">
                <LoadingSpinner size="lg" text="Searching..." />
              </div>
            )}

            {/* No query */}
            {!query && !isLoading && (
              <div className="text-center py-12">
                <SearchIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-xl text-muted-foreground">Enter a search query to get started</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try searching for topics like "AI automation", "React", or "business development"
                </p>
              </div>
            )}

            {/* No results */}
            {!isLoading && query && results.length === 0 && (
              <div className="text-center py-12">
                <SearchIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-xl mb-2">No results found for "{query}"</p>
                <p className="text-muted-foreground">
                  Try different keywords or check your spelling
                </p>
              </div>
            )}

            {/* Results */}
            {!isLoading && results.length > 0 && (
              <div className="space-y-6" role="region" aria-label="Search results">
                <div
                  className="flex items-center gap-2 text-sm font-medium"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <TrendingUp className="w-5 h-5 text-primary" aria-hidden="true" />
                  <span className="text-lg">
                    Found {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
                  </span>
                </div>

                <div className="space-y-4" role="list">
                  {results.map((result) => (
                    <Card
                      key={`${result.type}-${result.id}`}
                      className="cursor-pointer hover:shadow-lg transition-shadow group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                      onClick={() => handleResultClick(result)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleResultClick(result);
                        }
                      }}
                      tabIndex={0}
                      role="listitem"
                      aria-label={`${getTypeLabel(result.type)}: ${result.title}`}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          {result.image_url && (
                            <div className="flex-shrink-0">
                              <img
                                src={result.image_url}
                                alt={result.title}
                                loading="lazy"
                                decoding="async"
                                width={96}
                                height={96}
                                className="w-24 h-24 rounded-lg object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="text-primary" aria-hidden="true">
                                {getIcon(result.type)}
                              </div>
                              <Badge variant="outline">{getTypeLabel(result.type)}</Badge>
                              {result.category && (
                                <Badge variant="secondary">{result.category}</Badge>
                              )}
                            </div>
                            <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2">
                              {result.title}
                            </h3>
                            {(result.excerpt || result.description) && (
                              <p className="text-muted-foreground line-clamp-3 mb-3">
                                {result.excerpt || result.description}
                              </p>
                            )}
                            {result.tags && result.tags.length > 0 && (
                              <div className="flex gap-2 flex-wrap">
                                {result.tags.slice(0, 5).map((tag, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Search;
