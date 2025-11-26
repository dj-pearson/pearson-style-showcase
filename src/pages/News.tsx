import { useQuery } from '@tanstack/react-query';
import { logger } from "@/lib/logger";
import { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { ArticleCard } from '../components/ArticleCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { ArticleListSkeleton } from '@/components/skeletons';

type Article = Tables<"articles">;

const STORAGE_KEY_PREFIX = 'newsFilters';

const News = () => {
  const [email, setEmail] = useState('');
  const [searchTerm, setSearchTerm] = useState(() => {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}_search`) || '';
  });
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}_category`) || 'all';
  });
  const [sortBy, setSortBy] = useState<string>(() => {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}_sort`) || 'newest';
  });

  // Persist filters to localStorage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}_search`, searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}_category`, selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}_sort`, sortBy);
  }, [sortBy]);

  const { data: articles, isLoading, error } = useQuery({
    queryKey: ['articles'],
    queryFn: async () => {
      // Only select fields needed for article list view to reduce payload size
      const { data, error } = await supabase
        .from('articles')
        .select('id, slug, title, excerpt, category, tags, image_url, created_at, read_time, view_count, featured, author')
        .eq('published', true)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Article[];
    },
  });

  // Get unique categories for filtering
  const allCategories = articles
    ? Array.from(new Set(articles.map(a => a.category))).sort()
    : [];

  // Filter and sort articles
  const filteredArticles = articles?.filter(article => {
    const matchesSearch =
      article.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.excerpt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.tags?.some(tag => tag?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  const sortedArticles = [...filteredArticles].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      case 'oldest':
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      case 'most-viewed':
        return (b.view_count || 0) - (a.view_count || 0);
      case 'title':
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSortBy('newest');
    // Clear from localStorage
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}_search`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}_category`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}_sort`);
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement newsletter subscription
    logger.log('Subscribe:', email);
    setEmail('');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="AI Automation & Business Technology Insights | Expert Analysis | Dan Pearson"
        description="Expert insights on AI automation, business technology, and digital transformation. Learn proven strategies to implement AI, reduce costs, and streamline operations. Real-world case studies and practical guides from an experienced AI consultant serving 50+ businesses."
        keywords="AI automation guides, business automation insights, AI implementation strategies, digital transformation tips, AI tools comparison, business process automation, AI consultant insights, automation case studies, AI integration tutorials, business technology trends"
        url="https://danpearson.net/news"
        type="website"
      />
      <Navigation />
      <div id="main-content" className="flex-1 pt-20 sm:pt-24 px-4 sm:px-6">
        <div className="container mx-auto max-w-7xl">
          {/* Page Header */}
          <div className="text-center py-8 sm:py-12 lg:py-16">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 hero-gradient-text leading-tight">
              News & Insights
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-gray-400 max-w-2xl mx-auto px-2 leading-relaxed">
              Stay updated with the latest trends in AI, NFTs, blockchain technology, and business strategy insights.
            </p>
          </div>

          {/* Search and Filter Controls */}
          <div className="mobile-card bg-gray-800/30 border border-gray-700 rounded-xl mb-6 sm:mb-8">
            <div className="flex flex-col gap-4">
              {/* Search */}
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 pointer-events-none" />
                <Input
                  placeholder="Search articles, tags, or content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mobile-input pl-12 bg-gray-700/50 border-gray-600 focus:border-cyan-500 text-base"
                />
              </div>

              {/* Filters row */}
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                {/* Category Filter */}
                <div className="flex-1 sm:flex-initial">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="mobile-input w-full sm:w-[200px] bg-gray-700/50 border-gray-600">
                      <Filter className="h-5 w-5 mr-2" />
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent className="mobile-modal">
                      <SelectItem value="all">All Categories</SelectItem>
                      {allCategories.map(category => (
                        <SelectItem key={category} value={category} className="touch-target">{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort */}
                <div className="flex-1 sm:flex-initial">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="mobile-input w-full sm:w-[160px] bg-gray-700/50 border-gray-600">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent className="mobile-modal">
                      <SelectItem value="newest" className="touch-target">Newest</SelectItem>
                      <SelectItem value="oldest" className="touch-target">Oldest</SelectItem>
                      <SelectItem value="most-viewed" className="touch-target">Most Viewed</SelectItem>
                      <SelectItem value="title" className="touch-target">Title A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear Filters */}
                {(searchTerm || selectedCategory !== 'all' || sortBy !== 'newest') && (
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="mobile-button border-gray-600 hover:border-cyan-500 active:border-cyan-500"
                  >
                    <X className="h-5 w-5 mr-2" />
                    Clear All
                  </Button>
                )}
              </div>
            </div>

            {/* Active Filters Display */}
            {(searchTerm || selectedCategory !== 'all') && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-700">
                <span className="text-sm text-gray-400 font-medium">Active filters:</span>
                {searchTerm && (
                  <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-400 text-sm px-3 py-1">
                    Search: "{searchTerm}"
                  </Badge>
                )}
                {selectedCategory !== 'all' && (
                  <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-400 text-sm px-3 py-1">
                    Category: {selectedCategory}
                  </Badge>
                )}
              </div>
            )}

            {/* Results Count */}
            <div className="mt-4 text-base text-gray-400 font-medium">
              Showing {sortedArticles.length} of {articles?.length || 0} articles
            </div>
          </div>

          {/* Articles Grid */}
          <div className="pb-12 sm:pb-16">
            {isLoading ? (
              <ArticleListSkeleton count={6} />
            ) : error ? (
              <div className="text-center py-12 px-4">
                <div className="mobile-card bg-destructive/10 border-destructive/30 max-w-md mx-auto">
                  <p className="text-base text-destructive">Error loading articles. Please try again later.</p>
                </div>
              </div>
            ) : articles && articles.length > 0 ? (
              sortedArticles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {sortedArticles.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 px-4">
                  <div className="mobile-card bg-muted/30 max-w-md mx-auto">
                    <p className="text-base text-gray-400 mb-4">No articles match your current filters.</p>
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      className="mobile-button border-gray-600 hover:border-cyan-500"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <div className="text-center py-12 px-4">
                <p className="text-base text-gray-400">No articles found.</p>
              </div>
            )}
          </div>

          {/* Newsletter Signup */}
          <div className="text-center py-12 sm:py-16 border-t border-gray-800">
            <div className="bg-gray-800/50 border border-cyan-500/20 rounded-lg p-6 sm:p-8 max-w-2xl mx-auto">
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-white leading-tight">Stay Connected</h2>
              <p className="text-base text-gray-400 mb-5 sm:mb-6 leading-relaxed">
                Subscribe to get the latest insights on AI, technology, and business strategy delivered directly to your inbox.
              </p>
              <form onSubmit={handleSubscribe} className="flex flex-col gap-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-gray-700 border-gray-600 focus:border-cyan-500 min-h-[48px] text-base"
                  required
                />
                <Button 
                  type="submit"
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 min-h-[48px] sm:min-h-[52px] w-full"
                >
                  Subscribe
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default News;