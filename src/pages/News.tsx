import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { ArticleCard } from '../components/ArticleCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Article = Tables<"articles">;

const News = () => {
  const [email, setEmail] = useState('');

  const { data: articles, isLoading, error } = useQuery({
    queryKey: ['articles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('published', true)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Article[];
    },
  });

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement newsletter subscription
    console.log('Subscribe:', email);
    setEmail('');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SEO 
        title="AI & Tech News | Latest AI Developments & Business Technology Insights"
        description="Stay updated with the latest AI developments, tech innovations, and business technology insights. Expert analysis on AI tools, machine learning trends, and digital transformation strategies."
        keywords="AI news, tech news, artificial intelligence updates, machine learning trends, business technology, AI developments, tech insights, digital transformation, AI industry news"
        url="https://danpearson.net/news"
        type="website"
        structuredData={{
          type: 'website',
          data: {
            name: 'AI & Tech News',
            description: 'Latest news and insights on AI developments, tech innovations, and business technology trends',
            url: 'https://danpearson.net/news',
            mainEntity: {
              '@type': 'ItemList',
              name: 'Tech News Articles',
              description: 'Collection of articles about AI and technology developments',
              numberOfItems: articles?.length || 0
            }
          }
        }}
      />
      <Navigation />
      <div className="flex-1 pt-20 sm:pt-24 px-4 sm:px-6">
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

          {/* Articles Grid */}
          <div className="pb-12 sm:pb-16">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-80 bg-gray-800/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12 px-4">
                <p className="text-base text-gray-400">Error loading articles. Please try again later.</p>
              </div>
            ) : articles && articles.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {articles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
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