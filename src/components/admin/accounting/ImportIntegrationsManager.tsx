import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Download,
  FileText,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createImporter, ManualCSVImporter } from '@/services/accounting/importers';
import { DocumentUpload } from './DocumentUpload';

interface ImportSource {
  id: string;
  source_name: string;
  source_type: string;
  is_active: boolean;
  configuration: Record<string, any> | null;
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCSVUpload, setShowCSVUpload] = useState<string | null>(null);
  const [showDocUpload, setShowDocUpload] = useState(false);

  // Fetch import sources with TanStack Query
  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['import_sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_sources')
        .select('*')
        .order('source_name', { ascending: true });

      if (error) throw error;
      return (data || []) as ImportSource[];
    },
  });

  // Fetch import logs
  const { data: logs = [] } = useQuery({
    queryKey: ['import_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_logs')
        .select('*, import_sources(source_name)')
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as ImportLog[];
    },
  });

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

  // Run import mutation
  const importMutation = useMutation({
    mutationFn: async (source: ImportSource) => {
      const config = source.configuration || {};
      if (!config.api_key && source.source_type === 'api') {
        throw new Error(`Please configure ${source.source_name} API key first`);
      }

      // Create import log entry
      const { data: logData, error: logError } = await supabase
        .from('import_logs')
        .insert([{
          import_source_id: source.id,
          import_type: 'invoice',
          status: 'processing',
          records_total: 0,
        }])
        .select()
        .single();

      if (logError) throw logError;

      // Run the import
      const importer = createImporter(source.source_name, config.api_key || '');
      if (!importer) {
        throw new Error(`Importer not available for ${source.source_name}`);
      }

      const result = await importer.import();

      // Update import log
      await supabase
        .from('import_logs')
        .update({
          status: result.success ? 'completed' : 'failed',
          records_total: result.imported + result.failed,
          records_imported: result.imported,
          records_failed: result.failed,
          completed_at: new Date().toISOString(),
          error_message: result.errors.join(', ') || null,
        })
        .eq('id', logData.id);

      // Update last import time
      await supabase
        .from('import_sources')
        .update({ last_import_at: new Date().toISOString() })
        .eq('id', source.id);

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['import_logs'] });
      queryClient.invalidateQueries({ queryKey: ['import_sources'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({
        title: result.success ? 'Import Completed' : 'Import Completed with Errors',
        description: `Imported: ${result.imported}, Failed: ${result.failed}`,
        variant: result.success ? 'default' : 'destructive',
      });
    },
    onError: (error) => {
      logger.error('Error running import:', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to run import',
        variant: 'destructive',
      });
    },
  });

  // CSV upload handler
  const handleCSVUpload = async (file: File, sourceName: string) => {
    try {
      const content = await file.text();

      toast({
        title: 'Processing CSV',
        description: `Importing invoices from ${sourceName}...`,
      });

      const result = await ManualCSVImporter.import(content, sourceName);

      queryClient.invalidateQueries({ queryKey: ['import_logs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });

      toast({
        title: result.success ? 'Import Completed' : 'Import Failed',
        description: `Imported: ${result.imported}, Failed: ${result.failed}`,
        variant: result.success ? 'default' : 'destructive',
      });

      setShowCSVUpload(null);
    } catch (error) {
      logger.error('Error importing CSV:', error);
      toast({
        title: 'Error',
        description: 'Failed to import CSV file',
        variant: 'destructive',
      });
    }
  };

  // Export logs to CSV
  const handleExportLogs = () => {
    const csvLines: string[] = [];
    csvLines.push('Source,Type,Status,Total,Imported,Failed,Started,Completed,Error');

    logs.forEach((log) => {
      csvLines.push([
        `"${log.import_sources?.source_name || ''}"`,
        log.import_type,
        log.status,
        log.records_total,
        log.records_imported,
        log.records_failed,
        log.started_at,
        log.completed_at || '',
        `"${(log.error_message || '').replace(/"/g, '""')}"`,
      ].join(','));
    });

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `import-logs-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="sources" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sources">
            <Settings className="h-4 w-4 mr-2" />
            Import Sources
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload Documents
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : sources.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No import sources configured</p>
                  <p className="text-sm mt-1">Add platforms in the Platforms tab to enable imports</p>
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
                              <p className="text-xs text-muted-foreground">{source.source_type}</p>
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
                              <Button variant="outline" size="sm" className="flex-1">
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
                                  queryClient.invalidateQueries({ queryKey: ['import_sources'] });
                                  toast({ title: 'Success', description: 'Configuration saved' });
                                }}
                              />
                            </DialogContent>
                          </Dialog>
                          {source.source_type === 'api' ? (
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => importMutation.mutate(source)}
                              disabled={!source.is_active || !source.configuration?.api_key || importMutation.isPending}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              {importMutation.isPending ? 'Importing...' : 'Import Now'}
                            </Button>
                          ) : (
                            <Dialog open={showCSVUpload === source.id} onOpenChange={(open) => setShowCSVUpload(open ? source.id : null)}>
                              <DialogTrigger asChild>
                                <Button size="sm" className="flex-1">
                                  <Upload className="h-3 w-3 mr-1" />
                                  Upload CSV
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Upload {source.source_name} CSV</DialogTitle>
                                  <DialogDescription>
                                    Upload a CSV file with columns: Invoice Number, Date, Amount, Description, Currency
                                  </DialogDescription>
                                </DialogHeader>
                                <CSVUploadForm
                                  onUpload={(file) => handleCSVUpload(file, source.source_name)}
                                />
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Invoices & Receipts</CardTitle>
              <CardDescription>
                Upload PDF invoices or receipt images. AI will extract data and map it to the correct fields automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentUpload
                documentType="invoice"
                relatedEntityType="expense"
                autoProcess={true}
                showExistingDocuments={true}
                onUploadComplete={(documentId, parsedData) => {
                  if (parsedData) {
                    toast({
                      title: 'Document processed',
                      description: `Extracted: ${parsedData.vendor_name || 'Invoice'} - ${parsedData.total_amount ? `$${parsedData.total_amount}` : 'amount pending'}`,
                    });
                    queryClient.invalidateQueries({ queryKey: ['invoices'] });
                  }
                }}
                onError={(error) => logger.error('Upload error:', error)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Import History</CardTitle>
                  <CardDescription>View recent import operations and their status</CardDescription>
                </div>
                {logs.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleExportLogs}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                )}
              </div>
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
                          <TableCell className="text-right">{log.records_total}</TableCell>
                          <TableCell className="text-right">{log.records_imported}</TableCell>
                          <TableCell className="text-right">{log.records_failed}</TableCell>
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

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
          <CardDescription>How to configure each integration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Stripe
            </h4>
            <p className="text-sm text-muted-foreground">
              Get your API key from Stripe Dashboard. Use restricted keys with read-only billing access for security.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" /> OpenAI
            </h4>
            <p className="text-sm text-muted-foreground">
              Download invoices as PDF from OpenAI Platform billing page, then upload them here for AI parsing.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Code className="h-4 w-4" /> Anthropic (Claude)
            </h4>
            <p className="text-sm text-muted-foreground">
              Download invoices from Anthropic Console billing section. Upload PDFs for automatic data extraction.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" /> Any PDF Invoice
            </h4>
            <p className="text-sm text-muted-foreground">
              Upload any PDF invoice or receipt. Our AI will extract vendor, amount, date, line items, and map them to the correct expense categories.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Configuration form for import sources
const IntegrationConfigForm = ({
  source,
  onSuccess,
}: {
  source: ImportSource;
  onSuccess: () => void;
}) => {
  const [apiKey, setApiKey] = useState('');
  const [description, setDescription] = useState(source.configuration?.description || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const updatedConfig = {
        ...(source.configuration || {}),
        api_key: apiKey || source.configuration?.api_key,
        description: description,
      };

      const { error } = await supabase
        .from('import_sources')
        .update({
          configuration: updatedConfig,
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
          placeholder={source.configuration?.api_key ? '••••••••(saved)' : 'sk_test_...'}
        />
        <p className="text-xs text-muted-foreground">
          {source.configuration?.api_key
            ? 'Leave blank to keep existing key'
            : 'Your API key will be stored in the configuration'}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Production API key"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </form>
  );
};

// Simple CSV upload form (replaces the FileUpload dependency)
const CSVUploadForm = ({ onUpload }: { onUpload: (file: File) => void }) => {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Select CSV File</Label>
        <Input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Expected columns: Invoice Number, Date, Amount, Description, Currency
      </p>
      <Button
        onClick={() => file && onUpload(file)}
        disabled={!file}
        className="w-full"
      >
        <Upload className="h-4 w-4 mr-2" />
        Import CSV
      </Button>
    </div>
  );
};
