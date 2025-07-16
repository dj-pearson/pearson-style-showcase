import { useQuery } from '@tanstack/react-query';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Bot, Brain, Image, Code, FileText, Sparkles } from 'lucide-react';

type AITool = Tables<"ai_tools">;

const AITools = () => {
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
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
              Leverage cutting-edge AI technologies to transform your business operations and unlock new possibilities
            </p>
          </div>

          {/* AI Tools Grid */}
          <div className="pb-16">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-64 bg-gray-800/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-gray-400">Error loading AI tools. Please try again later.</p>
              </div>
            ) : tools && tools.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tools.map((tool) => (
                  <Card key={tool.id} className="group h-full bg-gray-800/50 border-gray-700 hover:border-cyan-500/50 transition-all duration-300">
                    <CardHeader>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 rounded-lg text-cyan-400">
                          {getIcon(tool.category)}
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-xl group-hover:text-cyan-400 transition-colors">
                            {tool.title}
                          </CardTitle>
                          <Badge variant="secondary" className="mt-1 bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                            {tool.category}
                          </Badge>
                        </div>
                      </div>
                      <CardDescription className="text-gray-400">
                        {tool.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {tool.features && tool.features.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Features:</h4>
                            <div className="flex flex-wrap gap-2">
                              {tool.features.map((feature, index) => (
                                <Badge 
                                  key={index} 
                                  variant="outline" 
                                  className="border-gray-600 text-gray-300"
                                >
                                  {feature}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">
                            {tool.pricing || 'Contact for pricing'}
                          </span>
                          <span className="text-sm text-gray-500">
                            {tool.complexity || 'Intermediate'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400">No AI tools found.</p>
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