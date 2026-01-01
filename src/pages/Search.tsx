import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { Search as SearchIcon, TrendingUp, FileText, Folder, Wrench, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Update query from URL parameter
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery) {
      setQuery(urlQuery);
    }
  }, [searchParams]);

  // Perform search when query changes
  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);

      try {
        // Search articles with full-text search
        const { data: articles } = await supabase
          .from('articles')
          .select('id, title, excerpt, slug, category, tags, image_url')
          .eq('published', true)
          .or(`title.ilike.%${query}%,excerpt.ilike.%${query}%,tags.cs.{${query}}`)
          .limit(10);

        // Search projects
        const { data: projects } = await supabase
          .from('projects')
          .select('id, title, description, slug, image_url')
          .eq('published', true)
          .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
          .limit(5);

        // Search AI tools
        const { data: aiTools } = await supabase
          .from('ai_tools')
          .select('id, title, description, category, link, image_url')
          .or(`title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
          .limit(5);

        // Combine and format results
        const combined: SearchResult[] = [
          ...(articles?.map(a => ({ ...a, type: 'article' as const })) || []),
          ...(projects?.map(p => ({ ...p, type: 'project' as const })) || []),
          ...(aiTools?.map(t => ({ ...t, type: 'ai_tool' as const, url: t.link })) || []),
        ];

        setResults(combined);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

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
    } else if (result.type === 'project' && result.slug) {
      navigate(`/projects#${result.slug}`);
    } else if (result.type === 'ai_tool' && result.url) {
      window.open(result.url, '_blank');
    }
  };

  // Get icon for result type
  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'article':
        return <FileText className="w-5 h-5" />;
      case 'project':
        return <Folder className="w-5 h-5" />;
      case 'ai_tool':
        return <Wrench className="w-5 h-5" />;
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
        description={query ? `Search results for ${query} across articles, projects, and AI tools on Dan Pearson's portfolio.` : 'Search across articles, projects, and AI tools on Dan Pearson\'s portfolio.'}
        url={`https://danpearson.net/search${query ? `?q=${encodeURIComponent(query)}` : ''}`}
        type="website"
        noIndex={false}
      />

      <Navigation />

      <div id="main-content" className="flex-1 pt-20 px-4 md:px-6">
        <div className="container mx-auto max-w-4xl">
          {/* Back Button */}
          <div className="mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
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
              <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for articles, projects, AI tools..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-12 h-14 text-lg"
                autoFocus
              />
            </div>
          </form>

          {/* Results Section */}
          <div className="mb-16">
            {/* Loading state */}
            {isLoading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Searching...</p>
              </div>
            )}

            {/* No query */}
            {!query && !isLoading && (
              <div className="text-center py-12">
                <SearchIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-xl text-muted-foreground">
                  Enter a search query to get started
                </p>
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
              <div
                className="space-y-6"
                role="region"
                aria-label="Search results"
              >
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
                                className="w-24 h-24 rounded-lg object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="text-primary" aria-hidden="true">
                                {getIcon(result.type)}
                              </div>
                              <Badge variant="outline">
                                {getTypeLabel(result.type)}
                              </Badge>
                              {result.category && (
                                <Badge variant="secondary">
                                  {result.category}
                                </Badge>
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
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="text-xs"
                                  >
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
      </div>

      <Footer />
    </div>
  );
};

export default Search;
