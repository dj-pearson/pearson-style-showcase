import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Bot, Brain, Image, Code, FileText, Sparkles, Filter, ExternalLink } from 'lucide-react';

type AITool = Tables<"ai_tools">;

const AITools = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const { data: tools, isLoading, error } = useQuery({
    queryKey: ['ai_tools'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_tools')
        .select('*')
        .eq('status', 'Active')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AITool[];
    },
  });

  // Filter tools based on selected category
  const filteredTools = tools?.filter(tool => 
    selectedCategory === 'all' || tool.category.toLowerCase() === selectedCategory.toLowerCase()
  ) || [];

  // Get unique categories for filter buttons
  const categories = ['all', ...Array.from(new Set(tools?.map(tool => tool.category) || []))];

  // Get category stats
  const categoryStats = tools?.reduce((acc, tool) => {
    acc[tool.category] = (acc[tool.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const getIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'chatbot':
        return <Bot className="w-8 h-8" />;
      case 'automation':
        return <Brain className="w-8 h-8" />;
      case 'image':
        return <Image className="w-8 h-8" />;
      case 'development':
        return <Code className="w-8 h-8" />;
      case 'content':
        return <FileText className="w-8 h-8" />;
      default:
        return <Sparkles className="w-8 h-8" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <div className="flex-1 pt-20 px-4 md:px-6">
        <div className="container mx-auto max-w-7xl">
          {/* Page Header */}
          <div className="text-center py-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 hero-gradient-text">
              AI Tools & Services
            </h1>
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              Discover 100+ revolutionary AI tools transforming work in 2025. From agentic AI systems to specialized industry solutions.
            </p>
            
            {/* Statistics */}
            {tools && tools.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                <div className="bg-gray-800/30 rounded-lg p-4">
                  <div className="text-2xl font-bold text-cyan-400">{tools.length}</div>
                  <div className="text-sm text-gray-400">Total Tools</div>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-4">
                  <div className="text-2xl font-bold text-cyan-400">{categories.length - 1}</div>
                  <div className="text-sm text-gray-400">Categories</div>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-4">
                  <div className="text-2xl font-bold text-cyan-400">
                    {tools.filter(tool => tool.pricing?.includes('Free') || tool.pricing === 'Freemium').length}
                  </div>
                  <div className="text-sm text-gray-400">Free Tools</div>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-4">
                  <div className="text-2xl font-bold text-cyan-400">2025</div>
                  <div className="text-sm text-gray-400">Latest</div>
                </div>
              </div>
            )}
          </div>

          {/* Category Filters */}
          {tools && tools.length > 0 && (
            <div className="flex flex-wrap gap-3 justify-center mb-8">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                onClick={() => setSelectedCategory('all')}
                className={selectedCategory === 'all' 
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600' 
                  : 'border-gray-600 hover:border-cyan-500/50'
                }
              >
                <Filter className="w-4 h-4 mr-2" />
                All ({tools.length})
              </Button>
              {categories.filter(cat => cat !== 'all').map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(category)}
                  className={selectedCategory === category 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600' 
                    : 'border-gray-600 hover:border-cyan-500/50'
                  }
                >
                  {getIcon(category)}
                  <span className="ml-2">{category} ({categoryStats[category] || 0})</span>
                </Button>
              ))}
            </div>
          )}

          {/* AI Tools Grid */}
          <div className="pb-16">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-80 bg-gray-800/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-gray-400">Error loading AI tools. Please try again later.</p>
              </div>
            ) : filteredTools.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTools.map((tool) => (
                  <Card key={tool.id} className="group h-full bg-gray-800/50 border-gray-700 hover:border-cyan-500/50 transition-all duration-300 animate-fade-in">
                    <CardHeader>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 rounded-lg text-cyan-400">
                          {getIcon(tool.category)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-xl group-hover:text-cyan-400 transition-colors flex-1">
                              {tool.title}
                            </CardTitle>
                            {tool.link && (
                              <a 
                                href={tool.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-cyan-400 transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                          <Badge variant="secondary" className="mt-1 bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                            {tool.category}
                          </Badge>
                        </div>
                      </div>
                      <CardDescription className="text-gray-400 line-clamp-3">
                        {tool.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {tool.features && tool.features.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Key Features:</h4>
                            <div className="flex flex-wrap gap-2">
                              {tool.features.slice(0, 4).map((feature, index) => (
                                <Badge 
                                  key={index} 
                                  variant="outline" 
                                  className="border-gray-600 text-gray-300 text-xs"
                                >
                                  {feature}
                                </Badge>
                              ))}
                              {tool.features.length > 4 && (
                                <Badge variant="outline" className="border-gray-600 text-gray-400 text-xs">
                                  +{tool.features.length - 4} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                          <div className="text-sm">
                            <span className="text-gray-500">Pricing: </span>
                            <span className="text-cyan-400 font-medium">
                              {tool.pricing || 'Contact for pricing'}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-500">Level: </span>
                            <span className={`font-medium ${
                              tool.complexity === 'Beginner' ? 'text-green-400' :
                              tool.complexity === 'Advanced' ? 'text-orange-400' : 'text-blue-400'
                            }`}>
                              {tool.complexity || 'Intermediate'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400">No AI tools found in the {selectedCategory} category.</p>
                <Button 
                  variant="outline" 
                  className="mt-4 border-gray-600 hover:border-cyan-500/50"
                  onClick={() => setSelectedCategory('all')}
                >
                  View All Tools
                </Button>
              </div>
            )}
          </div>

          {/* Benefits Section */}
          <div className="py-16 border-t border-gray-800">
            <div className="bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 rounded-lg p-8 max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold mb-6 text-center text-white">Why Choose AI Solutions?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                    <span className="text-gray-300">Increased productivity and efficiency</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                    <span className="text-gray-300">Cost-effective automation solutions</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                    <span className="text-gray-300">Competitive advantage through AI</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                    <span className="text-gray-300">Scalable and future-proof implementations</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center py-16">
            <div className="bg-gray-800/50 border border-cyan-500/20 rounded-lg p-8 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-4 text-white">Ready to Transform Your Business?</h2>
              <p className="text-gray-400 mb-6">
                Let's discuss how AI can revolutionize your operations and give you a competitive edge in today's market.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                  onClick={() => window.location.href = '/connect'}
                >
                  Schedule Consultation
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  className="border-gray-600 hover:border-cyan-500/50 hover:bg-cyan-500/10"
                  onClick={() => window.location.href = '/projects'}
                >
                  View Case Studies
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AITools;