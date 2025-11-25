import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  Receipt,
  FileText,
  PieChart,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface FinancialOverviewProps {
  onNavigate?: (tab: string) => void;
}

const FinancialOverview: React.FC<FinancialOverviewProps> = ({ onNavigate }) => {
  const currentMonth = useMemo(() => new Date(), []);
  const currentMonthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const currentMonthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);

  // Fetch invoices for revenue and expenses
  const { data: invoices } = useQuery({
    queryKey: ['invoices', 'overview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .gte('invoice_date', currentMonthStart.toISOString().split('T')[0])
        .lte('invoice_date', currentMonthEnd.toISOString().split('T')[0]);

      if (error) throw error;
      return data;
    },
  });

  // Fetch platform transactions
  const { data: platformTransactions } = useQuery({
    queryKey: ['platform_transactions', 'overview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_transactions')
        .select('*, platforms(name, platform_type)')
        .gte('transaction_date', currentMonthStart.toISOString().split('T')[0])
        .lte('transaction_date', currentMonthEnd.toISOString().split('T')[0])
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch Amazon affiliate stats for additional revenue
  const { data: amazonStats } = useQuery({
    queryKey: ['amazon_stats', 'overview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amazon_affiliate_stats')
        .select('revenue, commission')
        .gte('date', currentMonthStart.toISOString().split('T')[0])
        .lte('date', currentMonthEnd.toISOString().split('T')[0]);

      if (error) throw error;
      return data;
    },
  });

  // Fetch recent transactions for the last 6 months
  const { data: last6MonthsData } = useQuery({
    queryKey: ['transactions', 'last6months'],
    queryFn: async () => {
      const sixMonthsAgo = subMonths(currentMonth, 6);

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('invoice_date, invoice_type, total_amount, amount_paid')
        .gte('invoice_date', sixMonthsAgo.toISOString().split('T')[0]);

      if (invoiceError) throw invoiceError;

      const { data: platformData, error: platformError } = await supabase
        .from('platform_transactions')
        .select('transaction_date, transaction_type, amount')
        .gte('transaction_date', sixMonthsAgo.toISOString().split('T')[0]);

      if (platformError) throw platformError;

      return { invoices: invoiceData, platforms: platformData };
    },
  });

  // Calculate financial metrics
  const financialMetrics = useMemo(() => {
    let totalRevenue = 0;
    let totalExpenses = 0;
    let outstandingAmount = 0;

    // Calculate from invoices
    invoices?.forEach((invoice) => {
      if (invoice.invoice_type === 'sales') {
        totalRevenue += Number(invoice.amount_paid || 0);
        outstandingAmount += Number(invoice.amount_due || 0);
      } else if (invoice.invoice_type === 'purchase') {
        totalExpenses += Number(invoice.amount_paid || 0);
      }
    });

    // Calculate from platform transactions
    platformTransactions?.forEach((transaction) => {
      if (transaction.transaction_type === 'revenue') {
        totalRevenue += Number(transaction.amount || 0);
      } else if (transaction.transaction_type === 'expense') {
        totalExpenses += Number(transaction.amount || 0);
      }
    });

    // Add Amazon affiliate revenue
    amazonStats?.forEach((stat) => {
      totalRevenue += Number(stat.revenue || 0);
    });

    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalExpenses,
      outstandingAmount,
      netProfit,
      profitMargin,
    };
  }, [invoices, platformTransactions, amazonStats]);

  // Prepare chart data for last 6 months
  const chartData = useMemo(() => {
    if (!last6MonthsData) return [];

    const monthlyData: Record<string, { month: string; revenue: number; expenses: number }> = {};

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const month = subMonths(currentMonth, i);
      const monthKey = format(month, 'yyyy-MM');
      const monthLabel = format(month, 'MMM yyyy');
      monthlyData[monthKey] = { month: monthLabel, revenue: 0, expenses: 0 };
    }

    // Aggregate invoice data
    last6MonthsData.invoices?.forEach((invoice) => {
      const monthKey = invoice.invoice_date.substring(0, 7);
      if (monthlyData[monthKey]) {
        if (invoice.invoice_type === 'sales') {
          monthlyData[monthKey].revenue += Number(invoice.amount_paid || 0);
        } else if (invoice.invoice_type === 'purchase') {
          monthlyData[monthKey].expenses += Number(invoice.amount_paid || 0);
        }
      }
    });

    // Aggregate platform transaction data
    last6MonthsData.platforms?.forEach((transaction) => {
      const monthKey = transaction.transaction_date.substring(0, 7);
      if (monthlyData[monthKey]) {
        if (transaction.transaction_type === 'revenue') {
          monthlyData[monthKey].revenue += Number(transaction.amount || 0);
        } else if (transaction.transaction_type === 'expense') {
          monthlyData[monthKey].expenses += Number(transaction.amount || 0);
        }
      }
    });

    return Object.values(monthlyData);
  }, [last6MonthsData, currentMonth]);

  // Platform breakdown
  const platformBreakdown = useMemo(() => {
    const breakdown: Record<string, { revenue: number; expense: number; platform_type: string }> = {};

    platformTransactions?.forEach((transaction) => {
      const platformName = transaction.platforms?.name || 'Unknown';
      const platformType = transaction.platforms?.platform_type || 'unknown';

      if (!breakdown[platformName]) {
        breakdown[platformName] = { revenue: 0, expense: 0, platform_type: platformType };
      }

      if (transaction.transaction_type === 'revenue') {
        breakdown[platformName].revenue += Number(transaction.amount || 0);
      } else if (transaction.transaction_type === 'expense') {
        breakdown[platformName].expense += Number(transaction.amount || 0);
      }
    });

    return Object.entries(breakdown)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => (b.revenue + b.expense) - (a.revenue + a.expense))
      .slice(0, 5);
  }, [platformTransactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Financial Overview</h3>
        <p className="text-sm text-muted-foreground">
          {format(currentMonthStart, 'MMMM yyyy')} - Real-time financial metrics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(financialMetrics.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(financialMetrics.totalExpenses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(financialMetrics.outstandingAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Unpaid invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${financialMetrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(financialMetrics.netProfit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {financialMetrics.profitMargin.toFixed(1)}% margin
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue vs Expenses Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue vs Expenses (Last 6 Months)</CardTitle>
          <CardDescription>Track your financial performance over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stackId="1"
                  stroke="hsl(142, 76%, 36%)"
                  fill="hsl(142, 76%, 36%, 0.2)"
                  name="Revenue"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stackId="2"
                  stroke="hsl(0, 84%, 60%)"
                  fill="hsl(0, 84%, 60%, 0.2)"
                  name="Expenses"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Platform Breakdown and Recent Transactions */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Platforms */}
        <Card>
          <CardHeader>
            <CardTitle>Top Platforms (This Month)</CardTitle>
            <CardDescription>Revenue and expense breakdown by platform</CardDescription>
          </CardHeader>
          <CardContent>
            {platformBreakdown.length > 0 ? (
              <div className="space-y-4">
                {platformBreakdown.map((platform) => (
                  <div key={platform.name} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{platform.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {platform.platform_type}
                        </Badge>
                      </div>
                      <div className="flex gap-4 mt-1">
                        {platform.revenue > 0 && (
                          <span className="text-xs text-green-600">
                            Revenue: {formatCurrency(platform.revenue)}
                          </span>
                        )}
                        {platform.expense > 0 && (
                          <span className="text-xs text-red-600">
                            Expense: {formatCurrency(platform.expense)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No platform transactions this month</p>
                <button
                  onClick={() => onNavigate?.('platforms')}
                  className="text-xs text-primary hover:underline mt-2"
                >
                  Add platforms to start tracking
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest financial activity</CardDescription>
          </CardHeader>
          <CardContent>
            {platformTransactions && platformTransactions.length > 0 ? (
              <div className="space-y-3">
                {platformTransactions.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="flex items-start justify-between text-sm">
                    <div className="flex-1">
                      <p className="font-medium truncate">{transaction.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {transaction.platforms?.name || 'Unknown'}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(transaction.transaction_date), 'MMM d')}
                        </span>
                      </div>
                    </div>
                    <div className={`font-mono font-medium ${
                      transaction.transaction_type === 'revenue' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.transaction_type === 'revenue' ? '+' : '-'}
                      {formatCurrency(Math.abs(Number(transaction.amount)))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent transactions</p>
                <button
                  onClick={() => onNavigate?.('invoices')}
                  className="text-xs text-primary hover:underline mt-2"
                >
                  Create your first invoice
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FinancialOverview;
