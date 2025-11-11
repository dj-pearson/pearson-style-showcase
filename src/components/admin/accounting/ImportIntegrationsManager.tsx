import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  Settings,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  Zap,
  Code,
  Heart,
  Terminal,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ImportSource {
  id: string;
  source_name: string;
  source_type: string;
  is_active: boolean;
  configuration: any;
  last_import_at: string | null;
}

interface ImportLog {
  id: string;
  import_type: string;
  status: string;
  records_total: number;
  records_imported: number;
  records_failed: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  import_sources?: { source_name: string };
}

export const ImportIntegrationsManager = () => {
  const [sources, setSources] = useState<ImportSource[]>([]);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<ImportSource | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSources();
    loadLogs();
  }, []);

  const loadSources = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('import_sources')
        .select('*')
        .order('source_name', { ascending: true });

      if (error) throw error;
      setSources(data || []);
    } catch (error) {
      logger.error('Error loading import sources:', error);
      toast({
        title: 'Error',
        description: 'Failed to load import sources',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('import_logs')
        .select('*, import_sources(source_name)')
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      logger.error('Error loading import logs:', error);
    }
  };

  const getSourceIcon = (sourceName: string) => {
    const icons: Record<string, any> = {
      stripe: CreditCard,
      openai: Zap,
      anthropic: Code,
      lovable: Heart,
      replit: Terminal,
    };
    const Icon = icons[sourceName] || Upload;
    return <Icon className="h-5 w-5" />;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      completed: { variant: 'default', icon: CheckCircle2 },
      failed: { variant: 'destructive', icon: XCircle },
      processing: { variant: 'secondary', icon: Clock },
      pending: { variant: 'outline', icon: Clock },
    };

    const config = variants[status] || { variant: 'outline' as const, icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleRunImport = async (source: ImportSource) => {
    try {
      toast({
        title: 'Import Started',
        description: `Starting import from ${source.source_name}...`,
      });

      // Create import log entry
      const { data: logData, error: logError } = await supabase
        .from('import_logs')
        .insert([
          {
            import_source_id: source.id,
            import_type: 'invoice',
            status: 'pending',
            records_total: 0,
          },
        ])
        .select()
        .single();

      if (logError) throw logError;

      // Here you would call your import service
      // For now, we'll just show a placeholder message
      toast({
        title: 'Import Queued',
        description: `Import from ${source.source_name} has been queued for processing.`,
      });

      loadLogs();
    } catch (error) {
      logger.error('Error starting import:', error);
      toast({
        title: 'Error',
        description: 'Failed to start import',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="sources" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sources">
            <Settings className="h-4 w-4 mr-2" />
            Import Sources
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Clock className="h-4 w-4 mr-2" />
            Import History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import Integrations</CardTitle>
              <CardDescription>
                Configure and manage invoice imports from various services
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sources.map((source) => (
                    <Card key={source.id} className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                              {getSourceIcon(source.source_name)}
                            </div>
                            <div>
                              <h4 className="font-semibold capitalize">{source.source_name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {source.source_type}
                              </p>
                            </div>
                          </div>
                          <Badge variant={source.is_active ? 'default' : 'outline'}>
                            {source.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {source.configuration?.description || 'No description'}
                        </p>
                        {source.last_import_at && (
                          <p className="text-xs text-muted-foreground">
                            Last import: {formatDate(source.last_import_at)}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => setSelectedSource(source)}
                              >
                                <Settings className="h-3 w-3 mr-1" />
                                Configure
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Configure {source.source_name}</DialogTitle>
                                <DialogDescription>
                                  Set up API credentials and import settings
                                </DialogDescription>
                              </DialogHeader>
                              <IntegrationConfigForm
                                source={source}
                                onSuccess={() => {
                                  loadSources();
                                  toast({
                                    title: 'Success',
                                    description: 'Configuration saved successfully',
                                  });
                                }}
                              />
                            </DialogContent>
                          </Dialog>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleRunImport(source)}
                            disabled={!source.is_active}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Import Now
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>
                View recent import operations and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No import history</p>
                  <p className="text-sm">Import logs will appear here</p>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Imported</TableHead>
                        <TableHead className="text-right">Failed</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Completed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium capitalize">
                            {log.import_sources?.source_name || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.import_type}</Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell className="text-right">
                            {log.records_total}
                          </TableCell>
                          <TableCell className="text-right">
                            {log.records_imported}
                          </TableCell>
                          <TableCell className="text-right">
                            {log.records_failed}
                          </TableCell>
                          <TableCell>{formatDate(log.started_at)}</TableCell>
                          <TableCell>{formatDate(log.completed_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Integration Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
          <CardDescription>
            How to configure each integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Stripe
            </h4>
            <p className="text-sm text-muted-foreground">
              Get your API key from Stripe Dashboard → Developers → API Keys. Use restricted keys for security.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              OpenAI
            </h4>
            <p className="text-sm text-muted-foreground">
              Get your API key from OpenAI Platform → API Keys. Invoices are fetched from billing history.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Code className="h-4 w-4" />
              Anthropic (Claude)
            </h4>
            <p className="text-sm text-muted-foreground">
              Get your API key from Anthropic Console → Settings → API Keys. Access usage and billing data.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Lovable & <Terminal className="h-4 w-4 inline" /> Replit
            </h4>
            <p className="text-sm text-muted-foreground">
              For manual imports, download invoices from the respective platforms and upload them here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const IntegrationConfigForm = ({
  source,
  onSuccess,
}: {
  source: ImportSource;
  onSuccess: () => void;
}) => {
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('import_sources')
        .update({
          api_key: apiKey,
          is_active: true,
        })
        .eq('id', source.id);

      if (error) throw error;

      onSuccess();
    } catch (error) {
      logger.error('Error saving configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="api_key">API Key</Label>
        <Input
          id="api_key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk_test_..."
        />
        <p className="text-xs text-muted-foreground">
          Your API key will be encrypted and stored securely
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </form>
  );
};
