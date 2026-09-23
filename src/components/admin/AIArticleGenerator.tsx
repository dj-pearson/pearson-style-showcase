import { useState } from 'react';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, RefreshCw, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { invokeEdgeFunction } from '@/lib/edge-functions';

export const AIArticleGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedArticle, setGeneratedArticle] = useState<any>(null);
  const [skipReason, setSkipReason] = useState<string | null>(null);
  const { toast } = useToast();

  const generateArticle = async (force = false) => {
    setIsGenerating(true);
    setGeneratedArticle(null);
    setSkipReason(null);

    try {
      const { data, error } = await invokeEdgeFunction('generate-ai-article', {
        body: { force },
      });

      if (error) throw error;

      if (data?.skipped) {
        setSkipReason(data.reason);
        return;
      }

      if (data?.success) {
        setGeneratedArticle({ ...data.article, quality: data.quality });
        toast({
          title: data.published ? 'Brief published' : 'Brief saved as a draft',
          description: data.published
            ? "Today's AI news brief is live."
            : 'It failed the quality gate. Review it in Articles before publishing.',
        });
      } else {
        throw new Error(data?.error || 'Failed to generate article');
      }
    } catch (error) {
      logger.error('Error generating article:', error);
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Generation Failed',
        description: message,
        variant: 'destructive',
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
            Runs automatically every day at 12:00 UTC (Maintenance &gt; Daily AI News Brief). Use
            this to run it now. It makes one brief per day unless you force another.
          </AlertDescription>
        </Alert>

        <Button
          onClick={() => generateArticle(false)}
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
              Generate Today's Brief
            </>
          )}
        </Button>

        {skipReason && (
          <Alert>
            <AlertDescription className="flex flex-col gap-3">
              <span>Skipped: {skipReason}.</span>
              <Button variant="outline" size="sm" onClick={() => generateArticle(true)}>
                Generate another anyway
              </Button>
            </AlertDescription>
          </Alert>
        )}

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
                      {generatedArticle.published ? 'Published' : 'Draft'}
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
              {generatedArticle.quality?.issues?.length > 0 && (
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                  {generatedArticle.quality.issues.map(
                    (issue: { code: string; message: string }) => (
                      <li key={issue.code}>{issue.message}</li>
                    )
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">How it works:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>Reads the AI news feeds configured on the maintenance task</li>
            <li>Picks the story from the last 36 hours that matters most to businesses</li>
            <li>Reads the source article and writes an 800-1300 word analysis with FAQs</li>
            <li>Links only to the real sources and existing articles, then cites them</li>
            <li>Publishes if it passes the quality gate, otherwise saves a draft</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
