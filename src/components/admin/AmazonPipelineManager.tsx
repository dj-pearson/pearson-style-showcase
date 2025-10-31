import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Play, Settings, History, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const AmazonPipelineManager = () => {
  const [settings, setSettings] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [niches, setNiches] = useState<string>("");

  useEffect(() => {
    loadSettings();
    loadRuns();
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("amazon_pipeline_settings")
      .select("*")
      .single();

    if (error) {
      console.error("Error loading settings:", error);
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
      console.error("Error loading runs:", error);
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
        })
        .eq("id", settings.id);

      if (error) throw error;

      toast.success("Settings saved successfully");
      loadSettings();
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings: " + error.message);
    } finally {
      setIsSaving(false);
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
    } catch (error: any) {
      console.error("Pipeline error:", error);
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="run">
            <Play className="h-4 w-4 mr-2" />
            Run Pipeline
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Configuration</CardTitle>
              <CardDescription>Configure niches, filters, and generation settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="niches">Product Niches (comma-separated)</Label>
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
                  This will fetch Amazon products, analyze SEO data, generate an article, and publish it
                  immediately (unless review is required in settings).
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>Process:</strong>
                </p>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Select random niche from your configured list</li>
                  <li>Fetch products from Amazon PA-API</li>
                  <li>Filter by rating, stock, and price criteria</li>
                  <li>Analyze SEO keywords with DataForSEO</li>
                  <li>Generate human-sounding article with Lovable AI</li>
                  <li>Insert affiliate links with your Amazon tag</li>
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
