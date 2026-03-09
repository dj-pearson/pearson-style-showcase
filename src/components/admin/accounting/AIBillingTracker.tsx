import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Zap,
  Code,
  Bot,
  Plus,
  Upload,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Trash2,
  Edit,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { DocumentUpload } from './DocumentUpload';

interface AIBillingEntry {
  id: string;
  platform_id: string | null;
  service_name: string;
  billing_period_start: string;
  billing_period_end: string;
  total_amount: number;
  currency: string;
  usage_tokens_input?: number;
  usage_tokens_output?: number;
  usage_api_calls?: number;
  usage_compute_minutes?: number;
  model_breakdown?: Record<string, { cost: number; tokens?: number; calls?: number }>;
  invoice_number?: string;
  invoice_url?: string;
  notes?: string;
  document_id?: string;
  created_at: string;
}

const AI_SERVICES = [
  { value: 'openai', label: 'OpenAI', icon: Zap, color: 'text-green-600' },
  { value: 'anthropic', label: 'Anthropic (Claude)', icon: Code, color: 'text-orange-600' },
  { value: 'claude-code', label: 'Claude Code (CLI)', icon: Bot, color: 'text-purple-600' },
  { value: 'cursor', label: 'Cursor', icon: Bot, color: 'text-blue-600' },
  { value: 'github-copilot', label: 'GitHub Copilot', icon: Bot, color: 'text-gray-600' },
  { value: 'google-ai', label: 'Google AI / Gemini', icon: Bot, color: 'text-red-600' },
  { value: 'aws-bedrock', label: 'AWS Bedrock', icon: Bot, color: 'text-yellow-600' },
  { value: 'replicate', label: 'Replicate', icon: Bot, color: 'text-indigo-600' },
  { value: 'midjourney', label: 'Midjourney', icon: Bot, color: 'text-pink-600' },
  { value: 'lovable', label: 'Lovable', icon: Bot, color: 'text-rose-600' },
  { value: 'replit', label: 'Replit', icon: Bot, color: 'text-cyan-600' },
  { value: 'other-ai', label: 'Other AI Service', icon: Bot, color: 'text-gray-500' },
];

export const AIBillingTracker = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AIBillingEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<AIBillingEntry | null>(null);
  const [filterService, setFilterService] = useState<string>('all');
  const [dateRange, setDateRange] = useState('last-6-months');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch AI billing entries from platform_transactions with AI-related platforms
  const { data: billingEntries = [], isLoading } = useQuery({
    queryKey: ['ai-billing-entries', filterService],
    queryFn: async () => {
      let query = supabase
        .from('platform_transactions')
        .select('*, platforms(name, platform_type, logo_url)')
        .eq('transaction_type', 'expense')
        .order('transaction_date', { ascending: false });

      // Filter by AI platforms
      const { data: aiPlatforms } = await supabase
        .from('platforms')
        .select('id, name')
        .in('name', AI_SERVICES.map(s => s.label));

      const aiPlatformIds = aiPlatforms?.map(p => p.id) || [];

      if (aiPlatformIds.length > 0) {
        query = query.in('platform_id', aiPlatformIds);
      }

      if (filterService !== 'all') {
        const platform = aiPlatforms?.find(p =>
          p.name.toLowerCase().includes(filterService.toLowerCase())
        );
        if (platform) {
          query = query.eq('platform_id', platform.id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Fetch platforms for the form
  const { data: platforms = [] } = useQuery({
    queryKey: ['platforms', 'ai-billing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platforms')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate AI spending metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const thisMonthStart = startOfMonth(now).toISOString().split('T')[0];
    const thisMonthEnd = endOfMonth(now).toISOString().split('T')[0];
    const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString().split('T')[0];
    const lastMonthEnd = endOfMonth(subMonths(now, 1)).toISOString().split('T')[0];

    let thisMonthTotal = 0;
    let lastMonthTotal = 0;
    const serviceBreakdown: Record<string, number> = {};

    billingEntries.forEach((entry: any) => {
      const amount = Number(entry.amount || 0);
      const date = entry.transaction_date;
      const serviceName = entry.platforms?.name || 'Unknown';

      if (date >= thisMonthStart && date <= thisMonthEnd) {
        thisMonthTotal += amount;
      }
      if (date >= lastMonthStart && date <= lastMonthEnd) {
        lastMonthTotal += amount;
      }

      serviceBreakdown[serviceName] = (serviceBreakdown[serviceName] || 0) + amount;
    });

    const monthOverMonthChange = lastMonthTotal > 0
      ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
      : 0;

    const totalAllTime = billingEntries.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

    return {
      thisMonthTotal,
      lastMonthTotal,
      monthOverMonthChange,
      totalAllTime,
      serviceBreakdown: Object.entries(serviceBreakdown)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [billingEntries]);

  // Chart data: monthly spending over time
  const chartData = useMemo(() => {
    const now = new Date();
    const months: Record<string, Record<string, number>> = {};

    for (let i = 5; i >= 0; i--) {
      const month = subMonths(now, i);
      const key = format(month, 'yyyy-MM');
      months[key] = { _label: 0 };
    }

    billingEntries.forEach((entry: any) => {
      const key = entry.transaction_date?.substring(0, 7);
      if (months[key]) {
        const serviceName = entry.platforms?.name || 'Other';
        months[key][serviceName] = (months[key][serviceName] || 0) + Number(entry.amount || 0);
      }
    });

    return Object.entries(months).map(([key, data]) => {
      const { _label, ...services } = data;
      const total = Object.values(services).reduce((sum, v) => sum + v, 0);
      return {
        month: format(new Date(key + '-01'), 'MMM yyyy'),
        total,
        ...services,
      };
    });
  }, [billingEntries]);

  // Service breakdown for bar chart
  const serviceChartData = useMemo(() => {
    return metrics.serviceBreakdown.slice(0, 8);
  }, [metrics.serviceBreakdown]);

  // Create new AI billing entry
  const createMutation = useMutation({
    mutationFn: async (formData: any) => {
      // Find or create platform
      let platformId = formData.platform_id;

      if (!platformId && formData.service_name) {
        // Check if platform exists
        const { data: existing } = await supabase
          .from('platforms')
          .select('id')
          .eq('name', formData.service_name)
          .single();

        if (existing) {
          platformId = existing.id;
        } else {
          // Create platform
          const { data: newPlatform, error: createError } = await supabase
            .from('platforms')
            .insert({
              name: formData.service_name,
              platform_type: 'expense',
              is_active: true,
            })
            .select()
            .single();

          if (createError) throw createError;
          platformId = newPlatform.id;
        }
      }

      const { error } = await supabase
        .from('platform_transactions')
        .insert({
          platform_id: platformId,
          transaction_type: 'expense',
          transaction_date: formData.billing_period_start,
          amount: formData.total_amount,
          currency: formData.currency || 'USD',
          description: formData.notes || `AI billing: ${formData.service_name}`,
          reference_number: formData.invoice_number || null,
          external_url: formData.invoice_url || null,
          metadata: {
            billing_period_end: formData.billing_period_end,
            usage_tokens_input: formData.usage_tokens_input,
            usage_tokens_output: formData.usage_tokens_output,
            usage_api_calls: formData.usage_api_calls,
            usage_compute_minutes: formData.usage_compute_minutes,
            model_breakdown: formData.model_breakdown,
            source: 'ai-billing-tracker',
          },
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-billing-entries'] });
      queryClient.invalidateQueries({ queryKey: ['platform_transactions'] });
      toast({ title: 'Success', description: 'AI billing entry created' });
      setShowCreateDialog(false);
      setEditingEntry(null);
    },
    onError: (error) => {
      logger.error('Error creating AI billing entry:', error);
      toast({ title: 'Error', description: 'Failed to create billing entry', variant: 'destructive' });
    },
  });

  // Delete entry
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('platform_transactions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-billing-entries'] });
      toast({ title: 'Success', description: 'Entry deleted' });
    },
    onError: (error) => {
      logger.error('Error deleting entry:', error);
      toast({ title: 'Error', description: 'Failed to delete entry', variant: 'destructive' });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatNumber = (num: number | undefined) => {
    if (!num) return '-';
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getServiceIcon = (name: string) => {
    const service = AI_SERVICES.find(s =>
      name.toLowerCase().includes(s.value.split('-')[0])
    );
    if (service) {
      const Icon = service.icon;
      return <Icon className={`h-4 w-4 ${service.color}`} />;
    }
    return <Bot className="h-4 w-4 text-gray-500" />;
  };

  const handleExportCSV = () => {
    const csvLines: string[] = [];
    csvLines.push('Date,Service,Amount,Currency,Invoice #,Tokens In,Tokens Out,API Calls,Notes');

    billingEntries.forEach((entry: any) => {
      const meta = entry.metadata || {};
      csvLines.push([
        entry.transaction_date,
        `"${entry.platforms?.name || 'Unknown'}"`,
        Number(entry.amount || 0).toFixed(2),
        entry.currency || 'USD',
        `"${entry.reference_number || ''}"`,
        meta.usage_tokens_input || '',
        meta.usage_tokens_output || '',
        meta.usage_api_calls || '',
        `"${(entry.description || '').replace(/"/g, '""')}"`,
      ].join(','));
    });

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `ai-billing-export-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            AI Billing & Usage
          </h3>
          <p className="text-sm text-muted-foreground">
            Track spending across all AI services and tools
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Upload AI Service Invoice</DialogTitle>
                <DialogDescription>
                  Upload a PDF invoice from any AI service. Our AI will extract billing details automatically.
                </DialogDescription>
              </DialogHeader>
              <DocumentUpload
                documentType="invoice"
                relatedEntityType="expense"
                autoProcess={true}
                showExistingDocuments={false}
                onUploadComplete={(documentId, parsedData) => {
                  if (parsedData) {
                    setEditingEntry({
                      id: '',
                      platform_id: null,
                      service_name: parsedData.vendor_name || parsedData.vendorName || '',
                      billing_period_start: parsedData.invoice_date || parsedData.date || parsedData.billing_period_start || new Date().toISOString().split('T')[0],
                      billing_period_end: parsedData.billing_period_end || parsedData.due_date || '',
                      total_amount: parseFloat(parsedData.total_amount || parsedData.amount || '0'),
                      currency: parsedData.currency || 'USD',
                      invoice_number: parsedData.invoice_number || parsedData.invoiceNumber || '',
                      notes: parsedData.description || parsedData.notes || '',
                      usage_tokens_input: parsedData.tokens_input || parsedData.usage?.input_tokens,
                      usage_tokens_output: parsedData.tokens_output || parsedData.usage?.output_tokens,
                      usage_api_calls: parsedData.api_calls || parsedData.usage?.api_calls,
                      document_id: documentId,
                      created_at: new Date().toISOString(),
                    });
                    setShowUploadDialog(false);
                    setShowCreateDialog(true);
                    toast({
                      title: 'Data extracted',
                      description: 'Invoice data auto-filled. Review and save.',
                    });
                  } else {
                    setShowUploadDialog(false);
                    setShowCreateDialog(true);
                  }
                }}
                onError={(error) => logger.error('Upload error:', error)}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={showCreateDialog} onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) setEditingEntry(null);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingEntry?.id ? 'Edit' : 'Add'} AI Billing Entry
                </DialogTitle>
                <DialogDescription>
                  Record spending from an AI service or tool
                </DialogDescription>
              </DialogHeader>
              <AIBillingForm
                initialData={editingEntry}
                platforms={platforms}
                onSubmit={(data) => createMutation.mutate(data)}
                onClose={() => {
                  setShowCreateDialog(false);
                  setEditingEntry(null);
                }}
                isSubmitting={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.thisMonthTotal)}</div>
            <div className="flex items-center gap-1 mt-1">
              {metrics.monthOverMonthChange !== 0 && (
                <>
                  {metrics.monthOverMonthChange > 0 ? (
                    <TrendingUp className="h-3 w-3 text-red-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-green-500" />
                  )}
                  <span className={`text-xs ${metrics.monthOverMonthChange > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {Math.abs(metrics.monthOverMonthChange).toFixed(1)}% vs last month
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.lastMonthTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {format(subMonths(new Date(), 1), 'MMMM yyyy')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total All Time</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalAllTime)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {billingEntries.length} entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Service</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metrics.serviceBreakdown.length > 0 ? (
              <>
                <div className="text-2xl font-bold">{formatCurrency(metrics.serviceBreakdown[0].amount)}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {getServiceIcon(metrics.serviceBreakdown[0].name)}
                  {metrics.serviceBreakdown[0].name}
                </p>
              </>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">-</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly AI Spending</CardTitle>
            <CardDescription>Total spending across all AI services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.2)"
                    name="Total Spending"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by Service</CardTitle>
            <CardDescription>Breakdown of AI service costs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {serviceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serviceChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                    <YAxis type="category" dataKey="name" width={120} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" name="Total Spent" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No data yet</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Entries Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Billing Entries</CardTitle>
              <CardDescription>All AI service charges and invoices</CardDescription>
            </div>
            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {AI_SERVICES.map((service) => (
                  <SelectItem key={service.value} value={service.value}>
                    {service.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : billingEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No AI billing entries yet</p>
              <p className="text-sm mt-1">Upload an invoice PDF or add an entry manually to get started</p>
              <div className="flex gap-2 justify-center mt-4">
                <Button variant="outline" onClick={() => setShowUploadDialog(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Invoice
                </Button>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entry
                </Button>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Tokens In</TableHead>
                    <TableHead className="text-right">Tokens Out</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billingEntries.map((entry: any) => {
                    const meta = entry.metadata || {};
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getServiceIcon(entry.platforms?.name || '')}
                            <span className="font-medium">{entry.platforms?.name || 'Unknown'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.transaction_date ? format(parseISO(entry.transaction_date), 'MMM d, yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          {entry.reference_number ? (
                            entry.external_url ? (
                              <a
                                href={entry.external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {entry.reference_number}
                              </a>
                            ) : (
                              entry.reference_number
                            )
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(Number(entry.amount || 0))}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatNumber(meta.usage_tokens_input)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatNumber(meta.usage_tokens_output)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {entry.description || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingEntry(entry)}
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm('Delete this billing entry?')) {
                                  deleteMutation.mutate(entry.id);
                                }
                              }}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Entry Dialog */}
      <Dialog open={!!viewingEntry} onOpenChange={(open) => { if (!open) setViewingEntry(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Billing Entry Details</DialogTitle>
          </DialogHeader>
          {viewingEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Service</Label>
                  <p className="font-medium flex items-center gap-2">
                    {getServiceIcon(viewingEntry.platforms?.name || viewingEntry.service_name || '')}
                    {(viewingEntry as any).platforms?.name || viewingEntry.service_name}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Amount</Label>
                  <p className="font-medium font-mono">{formatCurrency(Number((viewingEntry as any).amount || viewingEntry.total_amount || 0))}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="font-medium">
                    {(viewingEntry as any).transaction_date
                      ? format(parseISO((viewingEntry as any).transaction_date), 'MMM d, yyyy')
                      : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Invoice #</Label>
                  <p className="font-medium">{(viewingEntry as any).reference_number || '-'}</p>
                </div>
              </div>
              {((viewingEntry as any).metadata?.usage_tokens_input || (viewingEntry as any).metadata?.usage_tokens_output) && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Usage Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Input Tokens</Label>
                      <p>{formatNumber((viewingEntry as any).metadata?.usage_tokens_input)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Output Tokens</Label>
                      <p>{formatNumber((viewingEntry as any).metadata?.usage_tokens_output)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">API Calls</Label>
                      <p>{formatNumber((viewingEntry as any).metadata?.usage_api_calls)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Compute Minutes</Label>
                      <p>{formatNumber((viewingEntry as any).metadata?.usage_compute_minutes)}</p>
                    </div>
                  </div>
                </div>
              )}
              {(viewingEntry as any).description && (
                <div className="border-t pt-4">
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <p className="text-sm">{(viewingEntry as any).description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Form component for creating/editing AI billing entries
const AIBillingForm = ({
  initialData,
  platforms,
  onSubmit,
  onClose,
  isSubmitting,
}: {
  initialData?: AIBillingEntry | null;
  platforms: any[];
  onSubmit: (data: any) => void;
  onClose: () => void;
  isSubmitting: boolean;
}) => {
  const [formData, setFormData] = useState({
    service_name: initialData?.service_name || '',
    platform_id: initialData?.platform_id || '',
    billing_period_start: initialData?.billing_period_start || new Date().toISOString().split('T')[0],
    billing_period_end: initialData?.billing_period_end || '',
    total_amount: initialData?.total_amount?.toString() || '',
    currency: initialData?.currency || 'USD',
    invoice_number: initialData?.invoice_number || '',
    invoice_url: initialData?.invoice_url || '',
    usage_tokens_input: initialData?.usage_tokens_input?.toString() || '',
    usage_tokens_output: initialData?.usage_tokens_output?.toString() || '',
    usage_api_calls: initialData?.usage_api_calls?.toString() || '',
    usage_compute_minutes: initialData?.usage_compute_minutes?.toString() || '',
    notes: initialData?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      total_amount: parseFloat(formData.total_amount) || 0,
      usage_tokens_input: formData.usage_tokens_input ? parseInt(formData.usage_tokens_input) : undefined,
      usage_tokens_output: formData.usage_tokens_output ? parseInt(formData.usage_tokens_output) : undefined,
      usage_api_calls: formData.usage_api_calls ? parseInt(formData.usage_api_calls) : undefined,
      usage_compute_minutes: formData.usage_compute_minutes ? parseFloat(formData.usage_compute_minutes) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>AI Service</Label>
          <Select
            value={formData.service_name}
            onValueChange={(value) => {
              const service = AI_SERVICES.find(s => s.value === value);
              setFormData({
                ...formData,
                service_name: service?.label || value,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select service" />
            </SelectTrigger>
            <SelectContent>
              {AI_SERVICES.map((service) => (
                <SelectItem key={service.value} value={service.value}>
                  <span className="flex items-center gap-2">
                    {service.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Total Amount</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.total_amount}
            onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Billing Period Start</Label>
          <Input
            type="date"
            value={formData.billing_period_start}
            onChange={(e) => setFormData({ ...formData, billing_period_start: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Billing Period End</Label>
          <Input
            type="date"
            value={formData.billing_period_end}
            onChange={(e) => setFormData({ ...formData, billing_period_end: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Invoice Number</Label>
          <Input
            value={formData.invoice_number}
            onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
            placeholder="INV-001"
          />
        </div>
        <div className="space-y-2">
          <Label>Invoice URL</Label>
          <Input
            value={formData.invoice_url}
            onChange={(e) => setFormData({ ...formData, invoice_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
      </div>

      {/* Usage Details (collapsible section) */}
      <details className="border rounded-lg p-3">
        <summary className="font-medium cursor-pointer text-sm">
          Usage Details (optional)
        </summary>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div className="space-y-2">
            <Label>Input Tokens</Label>
            <Input
              type="number"
              value={formData.usage_tokens_input}
              onChange={(e) => setFormData({ ...formData, usage_tokens_input: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>Output Tokens</Label>
            <Input
              type="number"
              value={formData.usage_tokens_output}
              onChange={(e) => setFormData({ ...formData, usage_tokens_output: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>API Calls</Label>
            <Input
              type="number"
              value={formData.usage_api_calls}
              onChange={(e) => setFormData({ ...formData, usage_api_calls: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>Compute Minutes</Label>
            <Input
              type="number"
              step="0.1"
              value={formData.usage_compute_minutes}
              onChange={(e) => setFormData({ ...formData, usage_compute_minutes: e.target.value })}
              placeholder="0"
            />
          </div>
        </div>
      </details>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes..."
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Entry'}
        </Button>
      </div>
    </form>
  );
};
