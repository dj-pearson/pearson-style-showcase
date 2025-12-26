import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Clock, TrendingUp, FileText, Folder, Wrench, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Save search to recent searches
  const saveToRecent = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    const updated = [
      searchQuery,
      ...recentSearches.filter(s => s !== searchQuery)
    ].slice(0, 5); // Keep only 5 most recent

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
      // Search articles with full-text search
      const { data: articles } = await supabase
        .from('articles')
        .select('id, title, excerpt, slug, category, tags, image_url')
        .eq('published', true)
        .or(`title.ilike.%${searchQuery}%,excerpt.ilike.%${searchQuery}%,tags.cs.{${searchQuery}}`)
        .limit(5);

      // Search projects
      const { data: projects } = await supabase
        .from('projects')
        .select('id, title, description, slug, image_url')
        .eq('published', true)
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .limit(3);

      // Search AI tools
      const { data: aiTools } = await supabase
        .from('ai_tools')
        .select('id, title, description, category, link, image_url')
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`)
        .limit(3);

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
    } else if (result.type === 'project' && result.slug) {
      navigate(`/projects#${result.slug}`);
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
      <DialogContent className="max-w-2xl max-h-[80vh] p-0">
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
              className="pl-11 pr-11 h-12 text-lg border-none focus-visible:ring-0 focus-visible:ring-offset-0"
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

        <ScrollArea className="h-[500px]">
          <div className="px-6 py-4">
            {/* Loading state */}
            {isLoading && (
              <div
                className="flex flex-col items-center justify-center py-8 gap-3"
                role="status"
                aria-label="Searching"
                aria-busy="true"
              >
                <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">Searching...</span>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearRecent}
                    className="text-xs"
                  >
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
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium mb-3">
                  <TrendingUp className="w-4 h-4" />
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </div>
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    className="w-full text-left px-3 py-3 rounded-md hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      {result.image_url && (
                        <img
                          src={result.image_url}
                          alt={result.title}
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
            )}
          </div>
        </ScrollArea>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t bg-muted/50 text-xs text-muted-foreground">
          <kbd className="px-2 py-1 bg-background rounded border">Esc</kbd> to close
          <span className="mx-2">·</span>
          <kbd className="px-2 py-1 bg-background rounded border">Enter</kbd> to select
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalSearch;
