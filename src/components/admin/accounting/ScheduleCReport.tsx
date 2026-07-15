import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, AlertTriangle, CheckCircle2, Calculator } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfYear, endOfYear } from 'date-fns';
import { toast } from 'sonner';

// IRS Schedule C line items
const SCHEDULE_C_EXPENSE_LINES: Record<string, string> = {
  '8': 'Advertising',
  '9': 'Car and truck expenses',
  '10': 'Commissions and fees',
  '11': 'Contract labor',
  '12': 'Depletion',
  '13': 'Depreciation and section 179',
  '14': 'Employee benefit programs',
  '15': 'Insurance (other than health)',
  '16a': 'Mortgage interest paid to banks, etc.',
  '16b': 'Other interest',
  '17': 'Legal and professional services',
  '18': 'Office expense',
  '19': 'Pension and profit-sharing plans',
  '20a': 'Rent — vehicles, machinery, equipment',
  '20b': 'Rent — other business property',
  '21': 'Repairs and maintenance',
  '22': 'Supplies',
  '23': 'Taxes and licenses',
  '24a': 'Travel',
  '24b': 'Deductible meals',
  '25': 'Utilities',
  '26': 'Wages',
  '27a': 'Other expenses',
};

// 2025 SE tax constants
const SS_WAGE_BASE_2025 = 176100;
const SS_RATE = 0.124;
const MEDICARE_RATE = 0.029;
const SE_NET_FACTOR = 0.9235;
const ADDITIONAL_MEDICARE_THRESHOLD = 200000;
const ADDITIONAL_MEDICARE_RATE = 0.009;

interface ScheduleCReportProps {
  homeOfficeDeduction?: number;
}

export const ScheduleCReport = ({ homeOfficeDeduction = 0 }: ScheduleCReportProps) => {
  const [taxYear, setTaxYear] = useState('2025');
  const queryClient = useQueryClient();

  const { dateFrom, dateTo } = useMemo(() => {
    const year = parseInt(taxYear);
    const yearDate = new Date(year, 0, 1);
    return {
      dateFrom: format(startOfYear(yearDate), 'yyyy-MM-dd'),
      dateTo: format(endOfYear(yearDate), 'yyyy-MM-dd'),
    };
  }, [taxYear]);

  // Fetch expense categories with IRS codes
  const { data: expenseCategories } = useQuery({
    queryKey: ['expense_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('category_code');
      if (error) throw error;
      return data;
    },
  });

  // Fetch sales invoices (revenue)
  const { data: salesInvoices } = useQuery({
    queryKey: ['invoices', 'sales', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('invoice_type', 'sales')
        .gte('invoice_date', dateFrom)
        .lte('invoice_date', dateTo);
      if (error) throw error;
      return data;
    },
  });

  // Fetch purchase invoices (expenses)
  const { data: purchaseInvoices } = useQuery({
    queryKey: ['invoices', 'purchase', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, invoice_items(*, accounts(id, account_name, account_type))')
        .eq('invoice_type', 'purchase')
        .gte('invoice_date', dateFrom)
        .lte('invoice_date', dateTo);
      if (error) throw error;
      return data;
    },
  });

  // Fetch platform transactions
  const { data: platformTransactions } = useQuery({
    queryKey: ['platform_transactions', 'schedule-c', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_transactions')
        .select('*, expense_categories(id, name, category_code), platforms(name, platform_type)')
        .gte('transaction_date', dateFrom)
        .lte('transaction_date', dateTo);
      if (error) throw error;
      return data;
    },
  });

  // Fetch journal entries (posted only)
  const { data: journalEntries } = useQuery({
    queryKey: ['journal_entries', 'schedule-c', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select(`
          *,
          journal_entry_lines (
            id, account_id, debit, credit, description,
            accounts (id, account_name, account_type, account_subtype)
          )
        `)
        .eq('status', 'posted')
        .gte('entry_date', dateFrom)
        .lte('entry_date', dateTo);
      if (error) throw error;
      return data;
    },
  });

  // Mutation to assign category to a purchase invoice
  const assignCategoryMutation = useMutation({
    mutationFn: async ({ invoiceId, categoryId }: { invoiceId: string; categoryId: string }) => {
      const invoice = purchaseInvoices?.find(i => i.id === invoiceId);
      const existingMetadata = (invoice?.metadata as Record<string, unknown>) || {};
      const { error } = await supabase
        .from('invoices')
        .update({
          metadata: { ...existingMetadata, expense_category_id: categoryId },
        })
        .eq('id', invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', 'purchase', dateFrom, dateTo] });
      toast.success('Invoice category updated');
    },
    onError: () => {
      toast.error('Failed to update category');
    },
  });

  // Build category-to-IRS-line lookup
  const categoryToLine = useMemo(() => {
    const map: Record<string, string> = {};
    expenseCategories?.forEach(cat => {
      if (cat.category_code) {
        map[cat.id] = cat.category_code;
      }
    });
    return map;
  }, [expenseCategories]);

  // Calculate Schedule C data
  const scheduleCData = useMemo(() => {
    // --- INCOME ---
    let grossReceipts = 0;
    let otherIncome = 0;

    // Sales invoices → gross receipts
    salesInvoices?.forEach(invoice => {
      grossReceipts += Number(invoice.amount_paid || 0);
    });

    // Platform revenue → gross receipts
    platformTransactions?.forEach(tx => {
      if (tx.transaction_type === 'revenue') {
        grossReceipts += Number(tx.amount || 0);
      }
    });

    // Journal entry income accounts
    journalEntries?.forEach(entry => {
      entry.journal_entry_lines?.forEach((line: any) => {
        if (line.accounts?.account_type === 'Income') {
          const amount = Number(line.credit || 0) - Number(line.debit || 0);
          if (line.accounts?.account_subtype === 'Other Income') {
            otherIncome += amount;
          } else {
            grossReceipts += amount;
          }
        }
      });
    });

    const grossProfit = grossReceipts; // No COGS for service business
    const grossIncome = grossProfit + otherIncome;

    // --- EXPENSES ---
    const expensesByLine: Record<string, number> = {};
    Object.keys(SCHEDULE_C_EXPENSE_LINES).forEach(line => {
      expensesByLine[line] = 0;
    });

    // Platform expense transactions → map via expense category
    platformTransactions?.forEach(tx => {
      if (tx.transaction_type === 'expense') {
        const categoryId = tx.expense_categories?.id;
        const lineCode = categoryId ? categoryToLine[categoryId] : null;
        if (lineCode && expensesByLine[lineCode] !== undefined) {
          expensesByLine[lineCode] += Number(tx.amount || 0);
        } else {
          expensesByLine['27a'] += Number(tx.amount || 0);
        }
      }
    });

    // Purchase invoices → map via metadata expense_category_id or account mapping
    const unmappedInvoices: Array<{ id: string; invoice_number: string; notes: string | null; amount: number; date: string }> = [];

    purchaseInvoices?.forEach(invoice => {
      const metadata = invoice.metadata as Record<string, unknown> | null;
      const categoryId = metadata?.expense_category_id as string | undefined;
      const amount = Number(invoice.amount_paid || invoice.total_amount || 0);

      if (categoryId && categoryToLine[categoryId]) {
        const lineCode = categoryToLine[categoryId];
        expensesByLine[lineCode] += amount;
      } else {
        // Try to map through invoice_items.account_id → expense_categories.account_id
        let mapped = false;
        if (invoice.invoice_items && Array.isArray(invoice.invoice_items)) {
          for (const item of invoice.invoice_items) {
            const itemAccountId = (item as any).account_id;
            if (itemAccountId) {
              const matchingCategory = expenseCategories?.find(cat => cat.account_id === itemAccountId);
              if (matchingCategory && matchingCategory.category_code) {
                expensesByLine[matchingCategory.category_code] += Number((item as any).line_total || 0);
                mapped = true;
              }
            }
          }
        }

        if (!mapped) {
          unmappedInvoices.push({
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            notes: invoice.notes,
            amount,
            date: invoice.invoice_date,
          });
          expensesByLine['27a'] += amount;
        }
      }
    });

    // Journal entry expense lines
    journalEntries?.forEach(entry => {
      entry.journal_entry_lines?.forEach((line: any) => {
        if (line.accounts?.account_type === 'Expense') {
          const amount = Number(line.debit || 0) - Number(line.credit || 0);
          // Try to find matching expense category via account_id
          const matchingCategory = expenseCategories?.find(cat => cat.account_id === line.account_id);
          if (matchingCategory && matchingCategory.category_code) {
            expensesByLine[matchingCategory.category_code] += amount;
          } else {
            expensesByLine['27a'] += amount;
          }
        }
      });
    });

    const totalExpenses = Object.values(expensesByLine).reduce((sum, val) => sum + val, 0);
    const tentativeProfit = grossIncome - totalExpenses;
    const netProfit = tentativeProfit - homeOfficeDeduction;

    // --- SELF-EMPLOYMENT TAX ---
    const seNetEarnings = Math.max(0, netProfit * SE_NET_FACTOR);
    const ssTaxable = Math.min(seNetEarnings, SS_WAGE_BASE_2025);
    const ssTax = ssTaxable * SS_RATE;
    const medicareTax = seNetEarnings * MEDICARE_RATE;
    const additionalMedicare = seNetEarnings > ADDITIONAL_MEDICARE_THRESHOLD
      ? (seNetEarnings - ADDITIONAL_MEDICARE_THRESHOLD) * ADDITIONAL_MEDICARE_RATE
      : 0;
    const totalSETax = ssTax + medicareTax + additionalMedicare;
    const deductibleSETax = totalSETax * 0.5;

    return {
      // Income
      grossReceipts,
      otherIncome,
      grossProfit,
      grossIncome,
      // Expenses
      expensesByLine,
      totalExpenses,
      // Profit
      tentativeProfit,
      homeOfficeDeduction,
      netProfit,
      // SE Tax
      seNetEarnings,
      totalSETax,
      deductibleSETax,
      // Unmapped
      unmappedInvoices,
    };
  }, [salesInvoices, purchaseInvoices, platformTransactions, journalEntries, expenseCategories, categoryToLine, homeOfficeDeduction]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleExport = () => {
    const lines: string[] = [];
    lines.push(`IRS Schedule C (Form 1040) - Profit or Loss From Business`);
    lines.push(`Tax Year: ${taxYear}`);
    lines.push(`Generated: ${format(new Date(), 'MMM d, yyyy')}`);
    lines.push('');

    lines.push('PART I - INCOME');
    lines.push(`Line,Description,Amount`);
    lines.push(`1,"Gross receipts or sales",${scheduleCData.grossReceipts.toFixed(2)}`);
    lines.push(`2,"Returns and allowances",0.00`);
    lines.push(`3,"Subtract line 2 from line 1",${scheduleCData.grossReceipts.toFixed(2)}`);
    lines.push(`4,"Cost of goods sold",0.00`);
    lines.push(`5,"Gross profit (line 3 minus line 4)",${scheduleCData.grossProfit.toFixed(2)}`);
    lines.push(`6,"Other income",${scheduleCData.otherIncome.toFixed(2)}`);
    lines.push(`7,"Gross income (line 5 plus line 6)",${scheduleCData.grossIncome.toFixed(2)}`);
    lines.push('');

    lines.push('PART II - EXPENSES');
    lines.push(`Line,Description,Amount`);
    Object.entries(SCHEDULE_C_EXPENSE_LINES).forEach(([lineNum, desc]) => {
      const amount = scheduleCData.expensesByLine[lineNum] || 0;
      if (amount > 0) {
        lines.push(`${lineNum},"${desc}",${amount.toFixed(2)}`);
      }
    });
    lines.push(`28,"Total expenses",${scheduleCData.totalExpenses.toFixed(2)}`);
    lines.push('');

    lines.push('NET PROFIT/LOSS');
    lines.push(`29,"Tentative profit (line 7 minus line 28)",${scheduleCData.tentativeProfit.toFixed(2)}`);
    lines.push(`30,"Business use of home (Form 8829)",${scheduleCData.homeOfficeDeduction.toFixed(2)}`);
    lines.push(`31,"Net profit or loss",${scheduleCData.netProfit.toFixed(2)}`);
    lines.push('');

    lines.push('SELF-EMPLOYMENT TAX ESTIMATE');
    lines.push(`,"Net earnings for SE tax (92.35% of line 31)",${scheduleCData.seNetEarnings.toFixed(2)}`);
    lines.push(`,"Total SE tax (15.3%)",${scheduleCData.totalSETax.toFixed(2)}`);
    lines.push(`,"Deductible portion (50% of SE tax)",${scheduleCData.deductibleSETax.toFixed(2)}`);

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `schedule-c-${taxYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Schedule C — Profit or Loss From Business</CardTitle>
              <CardDescription>
                IRS Form 1040, Schedule C — Single-Member LLC / Sole Proprietorship
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={taxYear} onValueChange={setTaxYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Part I - Income */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Part I — Income</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Line</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-[150px]">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-muted-foreground">1</TableCell>
                <TableCell>Gross receipts or sales</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(scheduleCData.grossReceipts)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-muted-foreground">2</TableCell>
                <TableCell>Returns and allowances</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(0)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-muted-foreground">5</TableCell>
                <TableCell>Gross profit</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(scheduleCData.grossProfit)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-muted-foreground">6</TableCell>
                <TableCell>Other income</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(scheduleCData.otherIncome)}</TableCell>
              </TableRow>
              <TableRow className="font-semibold bg-green-50 dark:bg-green-950/20">
                <TableCell className="font-mono">7</TableCell>
                <TableCell>Gross income</TableCell>
                <TableCell className="text-right font-mono text-green-700">
                  {formatCurrency(scheduleCData.grossIncome)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Part II - Expenses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Part II — Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Line</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-[150px]">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(SCHEDULE_C_EXPENSE_LINES).map(([lineNum, desc]) => {
                const amount = scheduleCData.expensesByLine[lineNum] || 0;
                if (amount === 0) return null;
                return (
                  <TableRow key={lineNum}>
                    <TableCell className="font-mono text-muted-foreground">{lineNum}</TableCell>
                    <TableCell>{desc}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(amount)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="font-semibold bg-red-50 dark:bg-red-950/20">
                <TableCell className="font-mono">28</TableCell>
                <TableCell>Total expenses</TableCell>
                <TableCell className="text-right font-mono text-red-700">
                  {formatCurrency(scheduleCData.totalExpenses)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Net Profit */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Net Profit or Loss</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-muted-foreground w-[80px]">29</TableCell>
                <TableCell>Tentative profit (Line 7 minus Line 28)</TableCell>
                <TableCell className="text-right font-mono w-[150px]">
                  {formatCurrency(scheduleCData.tentativeProfit)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-muted-foreground">30</TableCell>
                <TableCell>Expenses for business use of home (Form 8829)</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(scheduleCData.homeOfficeDeduction)}
                </TableCell>
              </TableRow>
              <TableRow className={`font-bold text-lg ${scheduleCData.netProfit >= 0 ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                <TableCell className="font-mono">31</TableCell>
                <TableCell>Net profit or loss</TableCell>
                <TableCell className={`text-right font-mono ${scheduleCData.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatCurrency(scheduleCData.netProfit)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Self-Employment Tax Estimate */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            <CardTitle className="text-lg">Self-Employment Tax Estimate (Schedule SE)</CardTitle>
          </div>
          <CardDescription>
            Single-member LLC owners pay SE tax (Social Security + Medicare) on net earnings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>Net earnings for SE tax (92.35% of Line 31)</TableCell>
                <TableCell className="text-right font-mono w-[150px]">
                  {formatCurrency(scheduleCData.seNetEarnings)}
                </TableCell>
              </TableRow>
              <TableRow className="font-semibold">
                <TableCell>Total self-employment tax (15.3%)</TableCell>
                <TableCell className="text-right font-mono text-red-700">
                  {formatCurrency(scheduleCData.totalSETax)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Deductible portion of SE tax (50%) — reduces AGI on 1040</TableCell>
                <TableCell className="text-right font-mono text-green-700">
                  {formatCurrency(scheduleCData.deductibleSETax)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">Estimated Total Federal Tax Liability</p>
                <p>
                  SE tax ({formatCurrency(scheduleCData.totalSETax)}) plus income tax on
                  net profit will be owed. Use the Quarterly Estimates tab to track your
                  1040-ES payments against this liability.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unmapped Purchase Invoices */}
      {scheduleCData.unmappedInvoices.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg">
                Unmapped Purchase Invoices ({scheduleCData.unmappedInvoices.length})
              </CardTitle>
            </div>
            <CardDescription>
              These purchase invoices are currently grouped under "Other expenses" (Line 27a).
              Assign them to the correct Schedule C category for accurate reporting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[250px]">Schedule C Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduleCData.unmappedInvoices.map(invoice => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                    <TableCell>{format(new Date(invoice.date), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {invoice.notes || '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(invoice.amount)}</TableCell>
                    <TableCell>
                      <Select
                        onValueChange={(categoryId) => {
                          assignCategoryMutation.mutate({ invoiceId: invoice.id, categoryId });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select category..." />
                        </SelectTrigger>
                        <SelectContent>
                          {expenseCategories
                            ?.filter(cat => cat.category_code)
                            .map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>
                                <span className="font-mono text-muted-foreground mr-2">
                                  L{cat.category_code}
                                </span>
                                {cat.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Mapped Indicator */}
      {scheduleCData.unmappedInvoices.length === 0 && purchaseInvoices && purchaseInvoices.length > 0 && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300">
            All purchase invoices are mapped to Schedule C categories
          </span>
        </div>
      )}
    </div>
  );
};
