import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, FileText, Receipt, CreditCard, DollarSign, Users, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears } from 'date-fns';

type ExportType = 'invoices' | 'payments' | 'transactions' | 'journal_entries' | 'contacts' | 'ai_billing' | 'all';

interface ExportField {
  key: string;
  label: string;
  enabled: boolean;
}

const EXPORT_CONFIGS: Record<string, { label: string; icon: any; fields: ExportField[] }> = {
  invoices: {
    label: 'Invoices & Bills',
    icon: FileText,
    fields: [
      { key: 'invoice_number', label: 'Invoice Number', enabled: true },
      { key: 'invoice_type', label: 'Type (Sales/Purchase)', enabled: true },
      { key: 'contact_name', label: 'Contact Name', enabled: true },
      { key: 'invoice_date', label: 'Invoice Date', enabled: true },
      { key: 'due_date', label: 'Due Date', enabled: true },
      { key: 'total_amount', label: 'Total Amount', enabled: true },
      { key: 'amount_paid', label: 'Amount Paid', enabled: true },
      { key: 'amount_due', label: 'Amount Due', enabled: true },
      { key: 'status', label: 'Status', enabled: true },
      { key: 'import_source', label: 'Import Source', enabled: true },
      { key: 'notes', label: 'Notes', enabled: false },
    ],
  },
  payments: {
    label: 'Payments',
    icon: CreditCard,
    fields: [
      { key: 'payment_number', label: 'Payment Number', enabled: true },
      { key: 'payment_type', label: 'Type (Received/Made)', enabled: true },
      { key: 'contact_name', label: 'Contact Name', enabled: true },
      { key: 'payment_date', label: 'Payment Date', enabled: true },
      { key: 'amount', label: 'Amount', enabled: true },
      { key: 'payment_method', label: 'Payment Method', enabled: true },
      { key: 'reference_number', label: 'Reference Number', enabled: true },
      { key: 'status', label: 'Status', enabled: true },
      { key: 'notes', label: 'Notes', enabled: false },
    ],
  },
  transactions: {
    label: 'Platform Transactions',
    icon: DollarSign,
    fields: [
      { key: 'platform_name', label: 'Platform', enabled: true },
      { key: 'transaction_date', label: 'Date', enabled: true },
      { key: 'transaction_type', label: 'Type (Revenue/Expense)', enabled: true },
      { key: 'amount', label: 'Amount', enabled: true },
      { key: 'currency', label: 'Currency', enabled: true },
      { key: 'description', label: 'Description', enabled: true },
      { key: 'category', label: 'Expense Category', enabled: true },
      { key: 'reference_number', label: 'Reference', enabled: true },
    ],
  },
  journal_entries: {
    label: 'Journal Entries',
    icon: Receipt,
    fields: [
      { key: 'entry_number', label: 'Entry Number', enabled: true },
      { key: 'entry_date', label: 'Date', enabled: true },
      { key: 'description', label: 'Description', enabled: true },
      { key: 'account_name', label: 'Account', enabled: true },
      { key: 'account_number', label: 'Account Number', enabled: true },
      { key: 'debit', label: 'Debit', enabled: true },
      { key: 'credit', label: 'Credit', enabled: true },
      { key: 'status', label: 'Status', enabled: true },
    ],
  },
  contacts: {
    label: 'Contacts',
    icon: Users,
    fields: [
      { key: 'contact_name', label: 'Name', enabled: true },
      { key: 'contact_type', label: 'Type', enabled: true },
      { key: 'email', label: 'Email', enabled: true },
      { key: 'phone', label: 'Phone', enabled: true },
      { key: 'company', label: 'Company', enabled: true },
      { key: 'address', label: 'Address', enabled: true },
      { key: 'tax_id', label: 'Tax ID', enabled: true },
      { key: 'payment_terms', label: 'Payment Terms', enabled: true },
    ],
  },
  ai_billing: {
    label: 'AI Billing & Usage',
    icon: Zap,
    fields: [
      { key: 'platform_name', label: 'AI Service', enabled: true },
      { key: 'transaction_date', label: 'Date', enabled: true },
      { key: 'amount', label: 'Amount', enabled: true },
      { key: 'currency', label: 'Currency', enabled: true },
      { key: 'reference_number', label: 'Invoice #', enabled: true },
      { key: 'description', label: 'Description', enabled: true },
      { key: 'tokens_input', label: 'Input Tokens', enabled: true },
      { key: 'tokens_output', label: 'Output Tokens', enabled: true },
      { key: 'api_calls', label: 'API Calls', enabled: true },
    ],
  },
};

export const DataExporter = () => {
  const [exportType, setExportType] = useState<ExportType>('invoices');
  const [dateRange, setDateRange] = useState('this-year');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fields, setFields] = useState<ExportField[]>(EXPORT_CONFIGS.invoices.fields);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleTypeChange = (type: ExportType) => {
    setExportType(type);
    if (type !== 'all' && EXPORT_CONFIGS[type]) {
      setFields(EXPORT_CONFIGS[type].fields.map(f => ({ ...f })));
    }
  };

  const toggleField = (key: string) => {
    setFields(fields.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));
  };

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'this-month': return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'last-month': { const lm = subMonths(now, 1); return { from: format(startOfMonth(lm), 'yyyy-MM-dd'), to: format(endOfMonth(lm), 'yyyy-MM-dd') }; }
      case 'this-year': return { from: format(startOfYear(now), 'yyyy-MM-dd'), to: format(endOfYear(now), 'yyyy-MM-dd') };
      case 'last-year': { const ly = subYears(now, 1); return { from: format(startOfYear(ly), 'yyyy-MM-dd'), to: format(endOfYear(ly), 'yyyy-MM-dd') }; }
      case 'all': return { from: '2000-01-01', to: '2099-12-31' };
      case 'custom': return { from: startDate || format(startOfYear(now), 'yyyy-MM-dd'), to: endDate || format(endOfYear(now), 'yyyy-MM-dd') };
      default: return { from: format(startOfYear(now), 'yyyy-MM-dd'), to: format(endOfYear(now), 'yyyy-MM-dd') };
    }
  };

  const exportData = async () => {
    setIsExporting(true);
    try {
      const { from, to } = getDateRange();
      const enabledFields = fields.filter(f => f.enabled);

      const csvLines: string[] = [];

      if (exportType === 'all') {
        // Export all data types
        for (const [type, config] of Object.entries(EXPORT_CONFIGS)) {
          const data = await fetchExportData(type, from, to);
          if (data.length > 0) {
            csvLines.push(`\n--- ${config.label} ---`);
            csvLines.push(config.fields.map(f => f.label).join(','));
            data.forEach(row => {
              csvLines.push(config.fields.map(f => escapeCSV(row[f.key])).join(','));
            });
            csvLines.push('');
          }
        }
      } else {
        const data = await fetchExportData(exportType, from, to);
        csvLines.push(enabledFields.map(f => f.label).join(','));
        data.forEach(row => {
          csvLines.push(enabledFields.map(f => escapeCSV(row[f.key])).join(','));
        });
      }

      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.setAttribute('href', URL.createObjectURL(blob));
      link.setAttribute('download', `accounting-${exportType}-${from}-to-${to}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: 'Export complete', description: `${exportType} data exported successfully` });
    } catch (error) {
      logger.error('Export error:', error);
      toast({ title: 'Export failed', description: 'Failed to export data', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Accounting Data
          </CardTitle>
          <CardDescription>
            Export your financial data to CSV with customizable field mapping
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Export Type */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(EXPORT_CONFIGS).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={key}
                  onClick={() => handleTypeChange(key as ExportType)}
                  className={`flex items-center gap-3 p-3 border rounded-lg text-left transition-colors ${
                    exportType === key ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${exportType === key ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium text-sm">{config.label}</p>
                  </div>
                </button>
              );
            })}
            <button
              onClick={() => handleTypeChange('all')}
              className={`flex items-center gap-3 p-3 border rounded-lg text-left transition-colors ${
                exportType === 'all' ? 'border-primary bg-primary/5' : 'hover:bg-accent'
              }`}
            >
              <Download className={`h-5 w-5 ${exportType === 'all' ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <p className="font-medium text-sm">Export All</p>
              </div>
            </button>
          </div>

          {/* Date Range */}
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                  <SelectItem value="last-year">Last Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dateRange === 'custom' && (
              <>
                <div className="flex-1">
                  <Label>From</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="flex-1">
                  <Label>To</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </>
            )}
          </div>

          {/* Field Selection */}
          {exportType !== 'all' && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Fields to Export</Label>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {fields.map((field) => (
                  <label
                    key={field.key}
                    className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-accent"
                  >
                    <Checkbox
                      checked={field.enabled}
                      onCheckedChange={() => toggleField(field.key)}
                    />
                    <span className="text-sm">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Export Button */}
          <Button onClick={exportData} disabled={isExporting} size="lg" className="w-full">
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export to CSV
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper to escape CSV values
function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Fetch data for export
async function fetchExportData(type: string, from: string, to: string): Promise<Record<string, any>[]> {
  switch (type) {
    case 'invoices': {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, contacts(contact_name)')
        .gte('invoice_date', from)
        .lte('invoice_date', to)
        .order('invoice_date', { ascending: false });

      if (error) throw error;

      return (data || []).map((inv: any) => ({
        invoice_number: inv.invoice_number,
        invoice_type: inv.invoice_type,
        contact_name: inv.contacts?.contact_name || '',
        invoice_date: inv.invoice_date,
        due_date: inv.due_date || '',
        total_amount: Number(inv.total_amount || 0).toFixed(2),
        amount_paid: Number(inv.amount_paid || 0).toFixed(2),
        amount_due: Number(inv.amount_due || 0).toFixed(2),
        status: inv.status,
        import_source: inv.import_source || 'manual',
        notes: inv.notes || '',
      }));
    }

    case 'payments': {
      const { data, error } = await supabase
        .from('payments')
        .select('*, contacts(contact_name)')
        .gte('payment_date', from)
        .lte('payment_date', to)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      return (data || []).map((pay: any) => ({
        payment_number: pay.payment_number,
        payment_type: pay.payment_type,
        contact_name: pay.contacts?.contact_name || '',
        payment_date: pay.payment_date,
        amount: Number(pay.amount || 0).toFixed(2),
        payment_method: pay.payment_method || '',
        reference_number: pay.reference_number || '',
        status: pay.status,
        notes: pay.notes || '',
      }));
    }

    case 'transactions': {
      const { data, error } = await supabase
        .from('platform_transactions')
        .select('*, platforms(name), expense_categories(name)')
        .gte('transaction_date', from)
        .lte('transaction_date', to)
        .order('transaction_date', { ascending: false });

      if (error) throw error;

      return (data || []).map((tx: any) => ({
        platform_name: tx.platforms?.name || '',
        transaction_date: tx.transaction_date,
        transaction_type: tx.transaction_type,
        amount: Number(tx.amount || 0).toFixed(2),
        currency: tx.currency || 'USD',
        description: tx.description || '',
        category: tx.expense_categories?.name || '',
        reference_number: tx.reference_number || '',
      }));
    }

    case 'journal_entries': {
      const { data, error } = await supabase
        .from('journal_entries')
        .select(`*, journal_entry_lines(*, accounts(account_name, account_number))`)
        .gte('entry_date', from)
        .lte('entry_date', to)
        .order('entry_date', { ascending: false });

      if (error) throw error;

      const rows: Record<string, any>[] = [];
      (data || []).forEach((entry: any) => {
        entry.journal_entry_lines?.forEach((line: any) => {
          rows.push({
            entry_number: entry.entry_number,
            entry_date: entry.entry_date,
            description: entry.description,
            account_name: line.accounts?.account_name || '',
            account_number: line.accounts?.account_number || '',
            debit: Number(line.debit || 0).toFixed(2),
            credit: Number(line.credit || 0).toFixed(2),
            status: entry.status,
          });
        });
      });
      return rows;
    }

    case 'contacts': {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('contact_name');

      if (error) throw error;

      return (data || []).map((c: any) => ({
        contact_name: c.contact_name,
        contact_type: c.contact_type,
        email: c.email || '',
        phone: c.phone || '',
        company: c.company_name || '',
        address: [c.address_line_1, c.address_line_2, c.city, c.state, c.postal_code, c.country].filter(Boolean).join(', '),
        tax_id: c.tax_id || '',
        payment_terms: c.payment_terms || '',
      }));
    }

    case 'ai_billing': {
      // Fetch AI-related platform transactions
      const { data: aiPlatforms, error: aiPlatformsError } = await supabase
        .from('platforms')
        .select('id, name')
        .or('name.ilike.%openai%,name.ilike.%anthropic%,name.ilike.%claude%,name.ilike.%cursor%,name.ilike.%copilot%,name.ilike.%gemini%,name.ilike.%replicate%,name.ilike.%midjourney%,name.ilike.%lovable%,name.ilike.%replit%');

      if (aiPlatformsError) throw aiPlatformsError;

      const aiPlatformIds = aiPlatforms?.map(p => p.id) || [];

      let query = supabase
        .from('platform_transactions')
        .select('*, platforms(name)')
        .eq('transaction_type', 'expense')
        .gte('transaction_date', from)
        .lte('transaction_date', to)
        .order('transaction_date', { ascending: false });

      if (aiPlatformIds.length > 0) {
        query = query.in('platform_id', aiPlatformIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((tx: any) => ({
        platform_name: tx.platforms?.name || '',
        transaction_date: tx.transaction_date,
        amount: Number(tx.amount || 0).toFixed(2),
        currency: tx.currency || 'USD',
        reference_number: tx.reference_number || '',
        description: tx.description || '',
        tokens_input: tx.metadata?.usage_tokens_input || '',
        tokens_output: tx.metadata?.usage_tokens_output || '',
        api_calls: tx.metadata?.usage_api_calls || '',
      }));
    }

    default:
      return [];
  }
}
