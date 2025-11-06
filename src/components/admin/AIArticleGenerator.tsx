import { useState } from 'react';
import { logger } from "@/lib/logger";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, RefreshCw, ExternalLink, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const AIArticleGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedArticle, setGeneratedArticle] = useState<any>(null);
  const { toast } = useToast();

  const generateArticle = async () => {
    setIsGenerating(true);
    setGeneratedArticle(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-article');

      if (error) throw error;

      if (data?.success) {
        setGeneratedArticle(data.article);
        toast({
          title: "Article Published!",
          description: "AI has created and published a new article based on the latest AI news.",
        });
      } else {
        throw new Error(data?.error || 'Failed to generate article');
      }
    } catch (error) {
      logger.error('Error generating article:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate article. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Article Generator
        </CardTitle>
        <CardDescription>
          Generate SEO-optimized articles based on the latest AI news
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            This tool browses artificialintelligence-news.com, selects a random article, 
            and uses AI to create a completely original, SEO-rich article with a unique perspective.
          </AlertDescription>
        </Alert>

        <Button
          onClick={generateArticle}
          disabled={isGenerating}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Generating Article...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate New Article
            </>
          )}
        </Button>

        {generatedArticle && (
          <Card className="bg-muted/50">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold">{generatedArticle.title}</h3>
                  <p className="text-sm text-muted-foreground">{generatedArticle.excerpt}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      {generatedArticle.category}
                    </span>
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      {generatedArticle.read_time}
                    </span>
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      Status: Published ✓
                    </span>
                  </div>
                  {generatedArticle.tags && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {generatedArticle.tags.map((tag: string) => (
                        <span key={tag} className="text-xs bg-secondary px-2 py-0.5 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Article published and live on your blog!
              </p>
            </CardContent>
          </Card>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">How it works:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>Scrapes latest articles from AI news website</li>
            <li>Selects a random trending topic</li>
            <li>AI researches and writes a unique 800-1200 word article</li>
            <li>Optimizes for SEO with keywords and metadata</li>
            <li>Automatically publishes to your blog</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
