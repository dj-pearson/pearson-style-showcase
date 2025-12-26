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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  TrendingUp,
  Download,
  AlertCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, subQuarters, subYears } from 'date-fns';

export const FinancialReports = () => {
  const [dateRange, setDateRange] = useState('this-month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Calculate date range based on selection
  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    let from: Date, to: Date;

    switch (dateRange) {
      case 'this-month':
        from = startOfMonth(now);
        to = endOfMonth(now);
        break;
      case 'last-month': {
        const lastMonth = subMonths(now, 1);
        from = startOfMonth(lastMonth);
        to = endOfMonth(lastMonth);
        break;
      }
      case 'this-quarter':
        from = startOfQuarter(now);
        to = endOfQuarter(now);
        break;
      case 'last-quarter': {
        const lastQuarter = subQuarters(now, 1);
        from = startOfQuarter(lastQuarter);
        to = endOfQuarter(lastQuarter);
        break;
      }
      case 'this-year':
        from = startOfYear(now);
        to = endOfYear(now);
        break;
      case 'last-year': {
        const lastYear = subYears(now, 1);
        from = startOfYear(lastYear);
        to = endOfYear(lastYear);
        break;
      }
      case 'custom':
        from = startDate ? new Date(startDate) : startOfMonth(now);
        to = endDate ? new Date(endDate) : endOfMonth(now);
        break;
      default:
        from = startOfMonth(now);
        to = endOfMonth(now);
    }

    return {
      dateFrom: format(from, 'yyyy-MM-dd'),
      dateTo: format(to, 'yyyy-MM-dd'),
    };
  }, [dateRange, startDate, endDate]);

  // Fetch invoices
  const { data: invoices } = useQuery({
    queryKey: ['invoices', 'reports', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .gte('invoice_date', dateFrom)
        .lte('invoice_date', dateTo);

      if (error) {
        logger.error('Error fetching invoices:', error);
        throw error;
      }

      return data;
    },
  });

  // Fetch platform transactions
  const { data: platformTransactions } = useQuery({
    queryKey: ['platform_transactions', 'reports', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_transactions')
        .select('*, platforms(name, platform_type), expense_categories(name, category_code)')
        .gte('transaction_date', dateFrom)
        .lte('transaction_date', dateTo);

      if (error) {
        logger.error('Error fetching platform transactions:', error);
        throw error;
      }

      return data;
    },
  });

  // Fetch journal entries (posted only)
  const { data: journalEntries } = useQuery({
    queryKey: ['journal_entries', 'reports', dateFrom, dateTo],
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
              account_number,
              account_name,
              account_type,
              account_subtype
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

  // Fetch accounts for balance sheet
  const { data: accounts } = useQuery({
    queryKey: ['accounts', 'reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('account_number');

      if (error) {
        logger.error('Error fetching accounts:', error);
        throw error;
      }

      return data;
    },
  });

  // Calculate P&L data
  const profitLossData = useMemo(() => {
    const revenue: Record<string, number> = {};
    const expenses: Record<string, number> = {};

    // Revenue from sales invoices
    invoices?.forEach((invoice) => {
      if (invoice.invoice_type === 'sales') {
        const amount = Number(invoice.amount_paid || 0);
        revenue['Sales Revenue'] = (revenue['Sales Revenue'] || 0) + amount;
      }
    });

    // Revenue from platform transactions
    platformTransactions?.forEach((transaction) => {
      if (transaction.transaction_type === 'revenue') {
        const amount = Number(transaction.amount || 0);
        const platformName = transaction.platforms?.name || 'Other Revenue';
        revenue[platformName] = (revenue[platformName] || 0) + amount;
      }
    });

    // Expenses from purchase invoices
    invoices?.forEach((invoice) => {
      if (invoice.invoice_type === 'purchase') {
        const amount = Number(invoice.amount_paid || 0);
        expenses['Vendor Expenses'] = (expenses['Vendor Expenses'] || 0) + amount;
      }
    });

    // Expenses from platform transactions
    platformTransactions?.forEach((transaction) => {
      if (transaction.transaction_type === 'expense') {
        const amount = Number(transaction.amount || 0);
        const categoryName = transaction.expense_categories?.name || 'Operating Expenses';
        expenses[categoryName] = (expenses[categoryName] || 0) + amount;
      }
    });

    // Add journal entry amounts (Income and Expense accounts only)
    journalEntries?.forEach((entry) => {
      entry.journal_entry_lines?.forEach((line: any) => {
        const accountType = line.accounts?.account_type;
        const accountName = line.accounts?.account_name || 'Other';
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);

        if (accountType === 'Income') {
          // Credits increase income
          const amount = credit - debit;
          revenue[accountName] = (revenue[accountName] || 0) + amount;
        } else if (accountType === 'Expense') {
          // Debits increase expenses
          const amount = debit - credit;
          expenses[accountName] = (expenses[accountName] || 0) + amount;
        }
      });
    });

    const totalRevenue = Object.values(revenue).reduce((sum, val) => sum + val, 0);
    const totalExpenses = Object.values(expenses).reduce((sum, val) => sum + val, 0);
    const netProfit = totalRevenue - totalExpenses;

    return {
      revenue,
      expenses,
      totalRevenue,
      totalExpenses,
      netProfit,
    };
  }, [invoices, platformTransactions, journalEntries]);

  // Calculate Balance Sheet data (as of end date)
  const balanceSheetData = useMemo(() => {
    const assets: Record<string, number> = {};
    const liabilities: Record<string, number> = {};
    const equity: Record<string, number> = {};

    // Calculate accounts receivable (unpaid sales invoices)
    let accountsReceivable = 0;
    invoices?.forEach((invoice) => {
      if (invoice.invoice_type === 'sales') {
        accountsReceivable += Number(invoice.amount_due || 0);
      }
    });
    if (accountsReceivable > 0) {
      assets['Accounts Receivable'] = accountsReceivable;
    }

    // Calculate accounts payable (unpaid purchase invoices)
    let accountsPayable = 0;
    invoices?.forEach((invoice) => {
      if (invoice.invoice_type === 'purchase') {
        accountsPayable += Number(invoice.amount_due || 0);
      }
    });
    if (accountsPayable > 0) {
      liabilities['Accounts Payable'] = accountsPayable;
    }

    // Add balances from accounts via journal entries
    const accountBalances: Record<string, number> = {};

    journalEntries?.forEach((entry) => {
      entry.journal_entry_lines?.forEach((line: any) => {
        const accountId = line.account_id;
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);

        if (!accountBalances[accountId]) {
          accountBalances[accountId] = 0;
        }

        // For Asset and Expense accounts, debits increase, credits decrease
        // For Liability, Equity, and Income accounts, credits increase, debits decrease
        const accountType = line.accounts?.account_type;
        if (accountType === 'Asset' || accountType === 'Expense') {
          accountBalances[accountId] += (debit - credit);
        } else {
          accountBalances[accountId] += (credit - debit);
        }
      });
    });

    // Add account balances to appropriate categories
    accounts?.forEach((account) => {
      const balance = accountBalances[account.id] || 0;

      // Also add opening balance
      const totalBalance = balance + Number(account.opening_balance || 0);

      if (totalBalance === 0) return;

      const accountName = account.account_name;

      if (account.account_type === 'Asset') {
        assets[accountName] = totalBalance;
      } else if (account.account_type === 'Liability') {
        liabilities[accountName] = totalBalance;
      } else if (account.account_type === 'Equity') {
        equity[accountName] = totalBalance;
      }
    });

    // Calculate retained earnings from P&L
    const retainedEarnings = profitLossData.netProfit;
    if (retainedEarnings !== 0) {
      equity['Retained Earnings'] = (equity['Retained Earnings'] || 0) + retainedEarnings;
    }

    const totalAssets = Object.values(assets).reduce((sum, val) => sum + val, 0);
    const totalLiabilities = Object.values(liabilities).reduce((sum, val) => sum + val, 0);
    const totalEquity = Object.values(equity).reduce((sum, val) => sum + val, 0);

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    };
  }, [invoices, journalEntries, accounts, profitLossData.netProfit]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDateRange = () => {
    return `${format(new Date(dateFrom), 'MMM d, yyyy')} - ${format(new Date(dateTo), 'MMM d, yyyy')}`;
  };

  // Export to CSV for tax reporting
  const handleExport = () => {
    // Prepare CSV content
    const csvLines: string[] = [];

    // Header
    csvLines.push('Financial Report');
    csvLines.push(`Period: ${formatDateRange()}`);
    csvLines.push('');

    // Profit & Loss Section
    csvLines.push('PROFIT & LOSS STATEMENT');
    csvLines.push('');
    csvLines.push('Revenue,Amount');

    Object.entries(profitLossData.revenue).forEach(([name, amount]) => {
      csvLines.push(`"${name}",${amount.toFixed(2)}`);
    });
    csvLines.push(`"Total Revenue",${profitLossData.totalRevenue.toFixed(2)}`);
    csvLines.push('');

    csvLines.push('Expenses,Amount');
    Object.entries(profitLossData.expenses).forEach(([name, amount]) => {
      csvLines.push(`"${name}",${amount.toFixed(2)}`);
    });
    csvLines.push(`"Total Expenses",${profitLossData.totalExpenses.toFixed(2)}`);
    csvLines.push('');
    csvLines.push(`"Net Profit",${profitLossData.netProfit.toFixed(2)}`);
    csvLines.push('');
    csvLines.push('');

    // Balance Sheet Section
    csvLines.push('BALANCE SHEET');
    csvLines.push(`As of: ${format(new Date(dateTo), 'MMM d, yyyy')}`);
    csvLines.push('');
    csvLines.push('Assets,Amount');

    Object.entries(balanceSheetData.assets).forEach(([name, amount]) => {
      csvLines.push(`"${name}",${amount.toFixed(2)}`);
    });
    csvLines.push(`"Total Assets",${balanceSheetData.totalAssets.toFixed(2)}`);
    csvLines.push('');

    csvLines.push('Liabilities,Amount');
    Object.entries(balanceSheetData.liabilities).forEach(([name, amount]) => {
      csvLines.push(`"${name}",${amount.toFixed(2)}`);
    });
    csvLines.push(`"Total Liabilities",${balanceSheetData.totalLiabilities.toFixed(2)}`);
    csvLines.push('');

    csvLines.push('Equity,Amount');
    Object.entries(balanceSheetData.equity).forEach(([name, amount]) => {
      csvLines.push(`"${name}",${amount.toFixed(2)}`);
    });
    csvLines.push(`"Total Equity",${balanceSheetData.totalEquity.toFixed(2)}`);
    csvLines.push('');
    csvLines.push(`"Total Liabilities & Equity",${(balanceSheetData.totalLiabilities + balanceSheetData.totalEquity).toFixed(2)}`);

    // Create CSV blob and download
    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `financial-report-${dateFrom}-to-${dateTo}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Financial Reports</CardTitle>
              <CardDescription>
                View Profit & Loss, Balance Sheet, and other financial reports
              </CardDescription>
            </div>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="this-quarter">This Quarter</SelectItem>
                  <SelectItem value="last-quarter">Last Quarter</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                  <SelectItem value="last-year">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dateRange === 'custom' && (
              <>
                <div className="flex-1">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <Tabs defaultValue="profit-loss" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profit-loss">
                <TrendingUp className="h-4 w-4 mr-2" />
                Profit & Loss
              </TabsTrigger>
              <TabsTrigger value="balance-sheet">
                <BarChart3 className="h-4 w-4 mr-2" />
                Balance Sheet
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profit-loss">
              <Card>
                <CardHeader>
                  <CardTitle>Profit & Loss Statement</CardTitle>
                  <CardDescription>
                    {formatDateRange()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Revenue Section */}
                    <div>
                      <h3 className="font-semibold text-lg mb-2 text-green-700">Revenue</h3>
                      <Table>
                        <TableBody>
                          {Object.entries(profitLossData.revenue).length > 0 ? (
                            Object.entries(profitLossData.revenue).map(([name, amount]) => (
                              <TableRow key={name}>
                                <TableCell>{name}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(amount)}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground">
                                No revenue for this period
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow className="font-medium bg-green-50 dark:bg-green-950/20">
                            <TableCell className="text-green-700">Total Revenue</TableCell>
                            <TableCell className="text-right font-mono text-green-700">
                              {formatCurrency(profitLossData.totalRevenue)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Expenses Section */}
                    <div>
                      <h3 className="font-semibold text-lg mb-2 text-red-700">Expenses</h3>
                      <Table>
                        <TableBody>
                          {Object.entries(profitLossData.expenses).length > 0 ? (
                            Object.entries(profitLossData.expenses).map(([name, amount]) => (
                              <TableRow key={name}>
                                <TableCell>{name}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(amount)}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground">
                                No expenses for this period
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow className="font-medium bg-red-50 dark:bg-red-950/20">
                            <TableCell className="text-red-700">Total Expenses</TableCell>
                            <TableCell className="text-right font-mono text-red-700">
                              {formatCurrency(profitLossData.totalExpenses)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Net Profit Section */}
                    <div className="pt-4 border-t-2">
                      <Table>
                        <TableBody>
                          <TableRow className="font-bold text-lg">
                            <TableCell>Net Profit</TableCell>
                            <TableCell className={`text-right font-mono ${profitLossData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(profitLossData.netProfit)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="balance-sheet">
              <Card>
                <CardHeader>
                  <CardTitle>Balance Sheet</CardTitle>
                  <CardDescription>
                    As of {format(new Date(dateTo), 'MMM d, yyyy')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Assets Section */}
                    <div>
                      <h3 className="font-semibold text-lg mb-2 text-blue-700">Assets</h3>
                      <Table>
                        <TableBody>
                          {Object.entries(balanceSheetData.assets).length > 0 ? (
                            Object.entries(balanceSheetData.assets).map(([name, amount]) => (
                              <TableRow key={name}>
                                <TableCell>{name}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(amount)}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground">
                                No assets recorded
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow className="font-medium bg-blue-50 dark:bg-blue-950/20">
                            <TableCell className="text-blue-700">Total Assets</TableCell>
                            <TableCell className="text-right font-mono text-blue-700">
                              {formatCurrency(balanceSheetData.totalAssets)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Liabilities Section */}
                    <div>
                      <h3 className="font-semibold text-lg mb-2 text-orange-700">Liabilities</h3>
                      <Table>
                        <TableBody>
                          {Object.entries(balanceSheetData.liabilities).length > 0 ? (
                            Object.entries(balanceSheetData.liabilities).map(([name, amount]) => (
                              <TableRow key={name}>
                                <TableCell>{name}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(amount)}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground">
                                No liabilities recorded
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow className="font-medium bg-orange-50 dark:bg-orange-950/20">
                            <TableCell className="text-orange-700">Total Liabilities</TableCell>
                            <TableCell className="text-right font-mono text-orange-700">
                              {formatCurrency(balanceSheetData.totalLiabilities)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Equity Section */}
                    <div>
                      <h3 className="font-semibold text-lg mb-2 text-purple-700">Equity</h3>
                      <Table>
                        <TableBody>
                          {Object.entries(balanceSheetData.equity).length > 0 ? (
                            Object.entries(balanceSheetData.equity).map(([name, amount]) => (
                              <TableRow key={name}>
                                <TableCell>{name}</TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(amount)}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground">
                                No equity recorded
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow className="font-medium bg-purple-50 dark:bg-purple-950/20">
                            <TableCell className="text-purple-700">Total Equity</TableCell>
                            <TableCell className="text-right font-mono text-purple-700">
                              {formatCurrency(balanceSheetData.totalEquity)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Total Liabilities & Equity */}
                    <div className="pt-4 border-t-2">
                      <Table>
                        <TableBody>
                          <TableRow className="font-bold text-lg">
                            <TableCell>Total Liabilities & Equity</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(balanceSheetData.totalLiabilities + balanceSheetData.totalEquity)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>

                      {/* Balance Check */}
                      <div className="mt-4 p-3 rounded-lg bg-muted">
                        <div className="flex items-center gap-2">
                          {balanceSheetData.isBalanced ? (
                            <>
                              <div className="h-2 w-2 rounded-full bg-green-500"></div>
                              <span className="text-sm font-medium text-green-700">
                                Balance Sheet is balanced ✓
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4 text-destructive" />
                              <span className="text-sm font-medium text-destructive">
                                Balance Sheet is not balanced - Assets: {formatCurrency(balanceSheetData.totalAssets)}, Liabilities + Equity: {formatCurrency(balanceSheetData.totalLiabilities + balanceSheetData.totalEquity)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
