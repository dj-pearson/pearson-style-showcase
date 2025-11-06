import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Play, Settings, History, TrendingUp, BarChart3 } from "lucide-react";
import { AmazonAffiliateStats } from "./AmazonAffiliateStats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const AmazonPipelineManager = () => {
  const [settings, setSettings] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [niches, setNiches] = useState<string>("");
  const [searchTermsCount, setSearchTermsCount] = useState<number>(0);
  const [unusedTermsCount, setUnusedTermsCount] = useState<number>(0);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    loadSettings();
    loadRuns();
    loadSearchTermsStats();
  }, []);

  const loadSearchTermsStats = async () => {
    const { count: total } = await supabase
      .from("amazon_search_terms")
      .select("*", { count: 'exact', head: true });
    
    const { count: unused } = await supabase
      .from("amazon_search_terms")
      .select("*", { count: 'exact', head: true })
      .is('used_at', null);

    setSearchTermsCount(total || 0);
    setUnusedTermsCount(unused || 0);
  };

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("amazon_pipeline_settings")
      .select("*")
      .single();

    if (error) {
      logger.error("Error loading settings:", error);
      return;
    }

    setSettings(data);
    setNiches((data.niches as string[]).join(", "));
  };

  const loadRuns = async () => {
    const { data, error } = await supabase
      .from("amazon_pipeline_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);

    if (error) {
      logger.error("Error loading runs:", error);
      return;
    }

    setRuns(data || []);
  };

  const saveSettings = async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      const nichesArray = niches.split(",").map(n => n.trim()).filter(Boolean);

      const { error } = await supabase
        .from("amazon_pipeline_settings")
        .update({
          niches: nichesArray,
          daily_post_count: settings.daily_post_count,
          min_rating: settings.min_rating,
          price_min: settings.price_min,
          price_max: settings.price_max,
          review_required: settings.review_required,
          word_count_target: settings.word_count_target,
          amazon_tag: settings.amazon_tag,
          cache_only_mode: settings.cache_only_mode,
        })
        .eq("id", settings.id);

      if (error) throw error;

      toast.success("Settings saved successfully");
      loadSettings();
    } catch (error: any) {
      logger.error("Error saving settings:", error);
      toast.error("Failed to save settings: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const seedSearchTerms = async () => {
    setIsSeeding(true);
    try {
      // Read the CSV file from public assets or fetch from a URL
      const response = await fetch('/amazon_ideas.csv');
      const csvText = await response.text();
      
      const lines = csvText.split('\n').slice(1); // Skip header
      const terms = lines
        .filter(line => line.trim())
        .map(line => {
          const [search_term, category] = line.split(',');
          return { search_term: search_term?.trim(), category: category?.trim() };
        })
        .filter(t => t.search_term && t.category);

      if (terms.length === 0) {
        throw new Error('No valid terms found in CSV');
      }

      // Insert in batches
      const batchSize = 100;
      let inserted = 0;
      for (let i = 0; i < terms.length; i += batchSize) {
        const batch = terms.slice(i, i + batchSize);
        const { error } = await supabase
          .from('amazon_search_terms')
          .insert(batch);
        
        if (error && !error.message.includes('duplicate')) {
          throw error;
        }
        inserted += batch.length;
      }

      toast.success(`Seeded ${inserted} search terms successfully`);
      loadSearchTermsStats();
    } catch (error: any) {
      logger.error('Seed error:', error);
      toast.error('Failed to seed search terms: ' + error.message);
    } finally {
      setIsSeeding(false);
    }
  };

  const resetSearchTerms = async () => {
    if (!confirm('Are you sure? This will reset all search terms to unused.')) return;
    
    try {
      const { error } = await supabase
        .from('amazon_search_terms')
        .update({ used_at: null, article_id: null, product_count: 0 })
        .not('id', 'is', null);

      if (error) throw error;

      toast.success('All search terms reset to unused');
      loadSearchTermsStats();
    } catch (error: any) {
      logger.error('Reset error:', error);
      toast.error('Failed to reset search terms: ' + error.message);
    }
  };

  const runPipeline = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("amazon-article-pipeline", {
        body: { requestedCount: 1, runReason: "manual" },
      });

      if (error) throw error;

      toast.success(`Article created: ${data.article.title}`);
      loadRuns();
      loadSearchTermsStats();
    } catch (error: any) {
      logger.error("Pipeline error:", error);
      toast.error("Pipeline failed: " + error.message);
    } finally {
      setIsRunning(false);
    }
  };

  if (!settings) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Amazon Affiliate Article Pipeline
          </CardTitle>
          <CardDescription>
            Autonomous product article generation with SEO optimization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              This pipeline automatically fetches Amazon products, analyzes SEO data, and generates
              high-ranking affiliate articles. Configure your settings and run manually or integrate with
              Make.com for daily automation.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="run">
            <Play className="h-4 w-4 mr-2" />
            Run Pipeline
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="h-4 w-4 mr-2" />
            Affiliate Stats
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Search Terms Database</CardTitle>
              <CardDescription>Manage CSV-based search terms for article generation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  The pipeline uses search terms from amazon_ideas.csv. Each term is used once to ensure unique articles.
                  <div className="mt-2 flex gap-4 text-sm font-medium">
                    <span>Total Terms: {searchTermsCount}</span>
                    <span className="text-green-600">Unused: {unusedTermsCount}</span>
                    <span className="text-amber-600">Used: {searchTermsCount - unusedTermsCount}</span>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button onClick={seedSearchTerms} disabled={isSeeding} variant="outline">
                  {isSeeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Seed from CSV
                </Button>
                <Button onClick={resetSearchTerms} variant="outline">
                  Reset All to Unused
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pipeline Configuration</CardTitle>
              <CardDescription>Configure niches, filters, and generation settings (fallback only)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertDescription className="text-xs">
                  Note: These niches are now only used as fallback if CSV search terms are unavailable.
                  The pipeline primarily uses terms from the CSV database.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="niches">Product Niches (comma-separated, fallback)</Label>
                <Input
                  id="niches"
                  value={niches}
                  onChange={(e) => setNiches(e.target.value)}
                  placeholder="home office, travel gear, fitness equipment"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amazon_tag">Amazon Associate Tag</Label>
                  <Input
                    id="amazon_tag"
                    value={settings.amazon_tag}
                    onChange={(e) => setSettings({ ...settings, amazon_tag: e.target.value })}
                    placeholder="yourtag-20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="word_count">Target Word Count</Label>
                  <Input
                    id="word_count"
                    type="number"
                    value={settings.word_count_target}
                    onChange={(e) => setSettings({ ...settings, word_count_target: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min_rating">Minimum Product Rating</Label>
                  <Input
                    id="min_rating"
                    type="number"
                    step="0.1"
                    value={settings.min_rating}
                    onChange={(e) => setSettings({ ...settings, min_rating: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="daily_count">Daily Post Count</Label>
                  <Input
                    id="daily_count"
                    type="number"
                    value={settings.daily_post_count}
                    onChange={(e) => setSettings({ ...settings, daily_post_count: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price_min">Min Price ($, optional)</Label>
                  <Input
                    id="price_min"
                    type="number"
                    value={settings.price_min || ""}
                    onChange={(e) => setSettings({ ...settings, price_min: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price_max">Max Price ($, optional)</Label>
                  <Input
                    id="price_max"
                    type="number"
                    value={settings.price_max || ""}
                    onChange={(e) => setSettings({ ...settings, price_max: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="cache_only"
                  checked={settings.cache_only_mode || false}
                  onCheckedChange={(checked) => setSettings({ ...settings, cache_only_mode: checked })}
                />
                <div className="flex flex-col">
                  <Label htmlFor="cache_only">Cache-only mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Skip Amazon API calls entirely. Uses cached products only (avoids throttling).
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="review_required"
                  checked={settings.review_required}
                  onCheckedChange={(checked) => setSettings({ ...settings, review_required: checked })}
                />
                <Label htmlFor="review_required">Require manual review before publishing</Label>
              </div>

              <Button onClick={saveSettings} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="run" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Run Pipeline</CardTitle>
              <CardDescription>Manually trigger the article generation pipeline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  This will fetch Amazon products, analyze SEO data, and generate an article.
                  {settings.cache_only_mode && (
                    <span className="block mt-2 font-medium text-amber-600">
                      Cache-only mode is ON. Will use cached products only (no API calls).
                    </span>
                  )}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>Process:</strong>
                </p>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Select random unused search term from CSV database</li>
                  <li>Fetch products using SerpAPI/Google Search</li>
                  <li>Retry with different term if insufficient products found</li>
                  <li>Filter by rating, stock, and price criteria</li>
                  <li>Analyze SEO keywords with DataForSEO</li>
                  <li>Generate human-sounding article with Lovable AI</li>
                  <li>Insert affiliate links with your Amazon tag</li>
                  <li>Mark search term as used to prevent duplicates</li>
                  <li>Publish to News section</li>
                </ol>
              </div>

              {settings.last_run_at && (
                <p className="text-sm text-muted-foreground">
                  Last run: {new Date(settings.last_run_at).toLocaleString()}
                </p>
              )}

              <Button onClick={runPipeline} disabled={isRunning} size="lg" className="w-full">
                {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Play className="mr-2 h-4 w-4" />
                Run Pipeline Now
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <AmazonAffiliateStats />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline History</CardTitle>
              <CardDescription>Recent pipeline executions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {runs.map((run) => (
                  <div key={run.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          run.status === 'success' ? 'default' :
                          run.status === 'running' ? 'secondary' :
                          'destructive'
                        }>
                          {run.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(run.started_at).toLocaleString()}
                        </span>
                      </div>
                      {run.note && (
                        <p className="text-sm">{run.note}</p>
                      )}
                      {run.posts_created > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Created: {run.posts_created} | Published: {run.posts_published}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {runs.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No runs yet. Click "Run Pipeline Now" to get started.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
