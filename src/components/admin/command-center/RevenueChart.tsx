import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, ShoppingCart, MousePointerClick } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { format, subDays } from 'date-fns';

interface RevenueData {
  date: string;
  revenue: number;
  clicks: number;
  orders: number;
  conversionRate: number;
}

interface RevenueSummary {
  totalRevenue: number;
  totalClicks: number;
  totalOrders: number;
  avgConversionRate: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

export const RevenueChart: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [summary, setSummary] = useState<RevenueSummary>({
    totalRevenue: 0,
    totalClicks: 0,
    totalOrders: 0,
    avgConversionRate: 0,
    trend: 'stable',
    trendPercentage: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRevenueData();
  }, [timeRange]);

  const loadRevenueData = async () => {
    try {
      setIsLoading(true);

      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = subDays(new Date(), days);

      // Fetch affiliate stats
      const { data: stats, error } = await supabase
        .from('amazon_affiliate_stats')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) {
        logger.error('Failed to load revenue data:', error);
        setIsLoading(false);
        return;
      }

      // Aggregate by date
      const dateMap = new Map<string, { revenue: number; clicks: number; orders: number }>();

      stats?.forEach(stat => {
        const existing = dateMap.get(stat.date) || { revenue: 0, clicks: 0, orders: 0 };
        dateMap.set(stat.date, {
          revenue: existing.revenue + Number(stat.revenue),
          clicks: existing.clicks + stat.clicks,
          orders: existing.orders + stat.orders
        });
      });

      // Convert to array and calculate conversion rates
      const chartData: RevenueData[] = Array.from(dateMap.entries()).map(([date, data]) => ({
        date,
        revenue: data.revenue,
        clicks: data.clicks,
        orders: data.orders,
        conversionRate: data.clicks > 0 ? (data.orders / data.clicks) * 100 : 0
      }));

      // Fill in missing dates with zero values
      const filledData: RevenueData[] = [];
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), days - i - 1), 'yyyy-MM-dd');
        const existing = chartData.find(d => d.date === date);
        filledData.push(existing || {
          date,
          revenue: 0,
          clicks: 0,
          orders: 0,
          conversionRate: 0
        });
      }

      setRevenueData(filledData);

      // Calculate summary
      const totalRevenue = filledData.reduce((sum, d) => sum + d.revenue, 0);
      const totalClicks = filledData.reduce((sum, d) => sum + d.clicks, 0);
      const totalOrders = filledData.reduce((sum, d) => sum + d.orders, 0);
      const avgConversionRate = totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0;

      // Calculate trend (compare first half vs second half)
      const midPoint = Math.floor(filledData.length / 2);
      const firstHalfRevenue = filledData.slice(0, midPoint).reduce((sum, d) => sum + d.revenue, 0);
      const secondHalfRevenue = filledData.slice(midPoint).reduce((sum, d) => sum + d.revenue, 0);
      const avgFirstHalf = firstHalfRevenue / midPoint;
      const avgSecondHalf = secondHalfRevenue / (filledData.length - midPoint);

      const trendPercentage = avgFirstHalf > 0 ?
        ((avgSecondHalf - avgFirstHalf) / avgFirstHalf) * 100 : 0;

      const trend: 'up' | 'down' | 'stable' =
        trendPercentage > 5 ? 'up' :
        trendPercentage < -5 ? 'down' :
        'stable';

      setSummary({
        totalRevenue,
        totalClicks,
        totalOrders,
        avgConversionRate,
        trend,
        trendPercentage
      });

      setIsLoading(false);
    } catch (error) {
      logger.error('Failed to load revenue data:', error);
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'MMM dd');
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium mb-2">{formatDate(data.date)}</p>
          <div className="space-y-1 text-xs">
            <p className="text-green-500">
              Revenue: {formatCurrency(data.revenue)}
            </p>
            <p className="text-blue-500">
              Clicks: {data.clicks}
            </p>
            <p className="text-purple-500">
              Orders: {data.orders}
            </p>
            <p className="text-orange-500">
              Conv. Rate: {data.conversionRate.toFixed(2)}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Amazon Affiliate Revenue
            </CardTitle>
            <CardDescription>Track your affiliate earnings and conversion metrics</CardDescription>
          </div>
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as '7d' | '30d' | '90d')}>
            <TabsList>
              <TabsTrigger value="7d">7D</TabsTrigger>
              <TabsTrigger value="30d">30D</TabsTrigger>
              <TabsTrigger value="90d">90D</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Total Revenue</span>
                  {summary.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                  {summary.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                </div>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</p>
                {summary.trend !== 'stable' && (
                  <p className={`text-xs mt-1 ${summary.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                    {summary.trend === 'up' ? '+' : ''}{summary.trendPercentage.toFixed(1)}% vs previous period
                  </p>
                )}
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Total Clicks</span>
                  <MousePointerClick className="h-4 w-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold">{summary.totalClicks.toLocaleString()}</p>
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Total Orders</span>
                  <ShoppingCart className="h-4 w-4 text-purple-500" />
                </div>
                <p className="text-2xl font-bold">{summary.totalOrders}</p>
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Avg Conv. Rate</span>
                </div>
                <p className="text-2xl font-bold">{summary.avgConversionRate.toFixed(2)}%</p>
              </div>
            </div>

            {/* Revenue Chart */}
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    className="text-xs"
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tickFormatter={(value) => `$${value}`}
                    className="text-xs"
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Clicks & Orders Chart */}
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    className="text-xs"
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    className="text-xs"
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    name="Clicks"
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={false}
                    name="Orders"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
