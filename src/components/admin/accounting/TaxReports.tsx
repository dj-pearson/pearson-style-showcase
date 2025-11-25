import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Download, FileText, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { format, startOfYear, endOfYear } from 'date-fns';

export const TaxReports = () => {
  const [taxYear, setTaxYear] = useState(new Date().getFullYear().toString());
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Calculate date range for tax year
  const { dateFrom, dateTo } = useMemo(() => {
    if (taxYear === 'custom') {
      return {
        dateFrom: customStartDate || format(startOfYear(new Date()), 'yyyy-MM-dd'),
        dateTo: customEndDate || format(endOfYear(new Date()), 'yyyy-MM-dd'),
      };
    }

    const year = parseInt(taxYear);
    const yearDate = new Date(year, 0, 1);

    return {
      dateFrom: format(startOfYear(yearDate), 'yyyy-MM-dd'),
      dateTo: format(endOfYear(yearDate), 'yyyy-MM-dd'),
    };
  }, [taxYear, customStartDate, customEndDate]);

  // Fetch expense categories (IRS Schedule C)
  const { data: expenseCategories } = useQuery({
    queryKey: ['expense_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('category_code');

      if (error) {
        logger.error('Error fetching expense categories:', error);
        throw error;
      }

      return data;
    },
  });

  // Fetch platform transactions (expenses only)
  const { data: platformTransactions } = useQuery({
    queryKey: ['platform_transactions', 'tax', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_transactions')
        .select('*, expense_categories(id, name, category_code), platforms(name)')
        .eq('transaction_type', 'expense')
        .gte('transaction_date', dateFrom)
        .lte('transaction_date', dateTo);

      if (error) {
        logger.error('Error fetching platform transactions:', error);
        throw error;
      }

      return data;
    },
  });

  // Fetch purchase invoices
  const { data: purchaseInvoices } = useQuery({
    queryKey: ['invoices', 'tax', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('invoice_type', 'purchase')
        .gte('invoice_date', dateFrom)
        .lte('invoice_date', dateTo);

      if (error) {
        logger.error('Error fetching invoices:', error);
        throw error;
      }

      return data;
    },
  });

  // Fetch journal entries (expense accounts only)
  const { data: journalEntries } = useQuery({
    queryKey: ['journal_entries', 'tax', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select(`
          *,
          journal_entry_lines (
            id,
            account_id,
            debit,
            credit,
            accounts (
              id,
              account_name,
              account_type
            )
          )
        `)
        .eq('status', 'posted')
        .gte('entry_date', dateFrom)
        .lte('entry_date', dateTo);

      if (error) {
        logger.error('Error fetching journal entries:', error);
        throw error;
      }

      return data;
    },
  });

  // Calculate tax data grouped by IRS Schedule C categories
  const taxData = useMemo(() => {
    const categoryTotals: Record<string, { name: string; code: string; total: number }> = {};

    // Initialize all expense categories
    expenseCategories?.forEach((cat) => {
      categoryTotals[cat.id] = {
        name: cat.name,
        code: cat.category_code || '',
        total: 0,
      };
    });

    // Add platform transaction expenses
    platformTransactions?.forEach((transaction) => {
      const categoryId = transaction.expense_categories?.id;
      if (categoryId && categoryTotals[categoryId]) {
        categoryTotals[categoryId].total += Number(transaction.amount || 0);
      } else {
        // Uncategorized expenses
        if (!categoryTotals['uncategorized']) {
          categoryTotals['uncategorized'] = {
            name: 'Uncategorized Expenses',
            code: '',
            total: 0,
          };
        }
        categoryTotals['uncategorized'].total += Number(transaction.amount || 0);
      }
    });

    // Add purchase invoice expenses (categorize as general business expenses)
    const generalExpenseCategory = expenseCategories?.find(cat => cat.name === 'Other Business Expenses');
    if (generalExpenseCategory) {
      purchaseInvoices?.forEach((invoice) => {
        categoryTotals[generalExpenseCategory.id].total += Number(invoice.amount_paid || 0);
      });
    }

    // Add journal entry expenses
    journalEntries?.forEach((entry) => {
      entry.journal_entry_lines?.forEach((line: any) => {
        if (line.accounts?.account_type === 'Expense') {
          const debit = Number(line.debit || 0);
          const credit = Number(line.credit || 0);
          const expenseAmount = debit - credit;

          // Add to uncategorized (could be enhanced to map accounts to categories)
          if (!categoryTotals['uncategorized']) {
            categoryTotals['uncategorized'] = {
              name: 'Uncategorized Expenses',
              code: '',
              total: 0,
            };
          }
          categoryTotals['uncategorized'].total += expenseAmount;
        }
      });
    });

    // Filter out categories with zero totals and sort by code
    const sortedCategories = Object.entries(categoryTotals)
      .filter(([_, data]) => data.total > 0)
      .sort((a, b) => {
        // Put uncategorized at the end
        if (a[0] === 'uncategorized') return 1;
        if (b[0] === 'uncategorized') return -1;
        // Sort by code
        return a[1].code.localeCompare(b[1].code);
      })
      .map(([id, data]) => ({ id, ...data }));

    const totalExpenses = sortedCategories.reduce((sum, cat) => sum + cat.total, 0);

    return {
      categories: sortedCategories,
      totalExpenses,
    };
  }, [expenseCategories, platformTransactions, purchaseInvoices, journalEntries]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Export tax report as CSV
  const handleExport = () => {
    const csvLines: string[] = [];

    // Header
    csvLines.push('IRS Schedule C Tax Report');
    csvLines.push(`Tax Year: ${taxYear === 'custom' ? `${dateFrom} to ${dateTo}` : taxYear}`);
    csvLines.push('');
    csvLines.push('Category,IRS Code,Amount');

    // Categories
    taxData.categories.forEach((cat) => {
      csvLines.push(`"${cat.name}","${cat.code}",${cat.total.toFixed(2)}`);
    });

    csvLines.push('');
    csvLines.push(`"Total Business Expenses","",${taxData.totalExpenses.toFixed(2)}`);

    // Create CSV blob and download
    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const filename = taxYear === 'custom'
      ? `schedule-c-expenses-${dateFrom}-to-${dateTo}.csv`
      : `schedule-c-expenses-${taxYear}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate year options
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let i = 0; i < 5; i++) {
    yearOptions.push((currentYear - i).toString());
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tax Reports - IRS Schedule C</CardTitle>
              <CardDescription>
                Business expense breakdown by IRS categories for tax filing
              </CardDescription>
            </div>
            <Button onClick={handleExport} disabled={taxData.categories.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Label>Tax Year</Label>
              <Select value={taxYear} onValueChange={setTaxYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {taxYear === 'custom' && (
              <>
                <div className="flex-1">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Schedule C Business Expenses</CardTitle>
              <CardDescription>
                Expense categories aligned with IRS Schedule C (Form 1040)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {taxData.categories.length > 0 ? (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>IRS Line</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {taxData.categories.map((cat) => (
                          <TableRow key={cat.id}>
                            <TableCell className="font-medium text-muted-foreground">
                              {cat.code || '-'}
                            </TableCell>
                            <TableCell>{cat.name}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(cat.total)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold bg-muted">
                          <TableCell colSpan={2}>Total Business Expenses</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(taxData.totalExpenses)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                          Tax Filing Information
                        </h4>
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          These expense totals correspond to IRS Schedule C (Form 1040) line items.
                          Export this data and provide it to your tax preparer or use it to complete
                          your Schedule C form. Keep all receipts and documentation for these expenses
                          as required by the IRS.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No Expenses Found</p>
                  <p className="text-sm">
                    No business expenses recorded for{' '}
                    {taxYear === 'custom' ? 'the selected date range' : `tax year ${taxYear}`}
                  </p>
                  <p className="text-sm mt-2">
                    Add platform transactions, purchase invoices, or journal entries to see them here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};
