import { useState, useEffect, useCallback } from "react";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, MousePointerClick, ShoppingCart, TrendingUp } from "lucide-react";
import { format, subDays } from "date-fns";
import { AmazonReportImporter } from "./AmazonReportImporter";

interface AffiliateStats {
  totalClicks: number;
  totalOrders: number;
  totalRevenue: number;
  totalCommission: number;
  conversionRate: number;
  topArticles: Array<{
    article_id: string;
    article_title: string;
    clicks: number;
    orders: number;
    revenue: number;
  }>;
  topProducts: Array<{
    asin: string;
    product_title: string;
    clicks: number;
    orders: number;
    revenue: number;
  }>;
  dailyStats: Array<{
    date: string;
    clicks: number;
    orders: number;
    revenue: number;
  }>;
}

export const AmazonAffiliateStats = () => {
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(30); // Last 30 days by default

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = format(subDays(new Date(), dateRange), 'yyyy-MM-dd');
      
      // Get aggregate stats
      const { data: aggregateData } = await supabase
        .from('amazon_affiliate_stats')
        .select('clicks, orders, revenue, commission')
        .gte('date', startDate);

      const totalClicks = aggregateData?.reduce((sum, row) => sum + row.clicks, 0) || 0;
      const totalOrders = aggregateData?.reduce((sum, row) => sum + row.orders, 0) || 0;
      const totalRevenue = aggregateData?.reduce((sum, row) => sum + Number(row.revenue), 0) || 0;
      const totalCommission = aggregateData?.reduce((sum, row) => sum + Number(row.commission), 0) || 0;
      const conversionRate = totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0;

      // Get top articles
      const { data: articlesData } = await supabase
        .from('amazon_affiliate_stats')
        .select('article_id, clicks, orders, revenue, articles(title)')
        .gte('date', startDate)
        .order('clicks', { ascending: false })
        .limit(10);

      const articleMap = new Map();
      articlesData?.forEach(row => {
        const id = row.article_id;
        if (!articleMap.has(id)) {
          articleMap.set(id, {
            article_id: id,
            article_title: (row.articles as any)?.title || 'Unknown',
            clicks: 0,
            orders: 0,
            revenue: 0,
          });
        }
        const article = articleMap.get(id);
        article.clicks += row.clicks;
        article.orders += row.orders;
        article.revenue += Number(row.revenue);
      });
      const topArticles = Array.from(articleMap.values())
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10);

      // Get top products
      const { data: productsData } = await supabase
        .from('amazon_affiliate_stats')
        .select('asin, clicks, orders, revenue, article_products(asin)')
        .gte('date', startDate)
        .order('clicks', { ascending: false })
        .limit(10);

      const productMap = new Map();
      productsData?.forEach(row => {
        const asin = row.asin;
        if (!productMap.has(asin)) {
          productMap.set(asin, {
            asin: asin,
            product_title: asin, // We'll need to join with amazon_products for title
            clicks: 0,
            orders: 0,
            revenue: 0,
          });
        }
        const product = productMap.get(asin);
        product.clicks += row.clicks;
        product.orders += row.orders;
        product.revenue += Number(row.revenue);
      });
      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10);

      // Get daily stats for chart
      const { data: dailyData } = await supabase
        .from('amazon_affiliate_stats')
        .select('date, clicks, orders, revenue')
        .gte('date', startDate)
        .order('date', { ascending: true });

      const dailyMap = new Map();
      dailyData?.forEach(row => {
        const date = row.date;
        if (!dailyMap.has(date)) {
          dailyMap.set(date, { date, clicks: 0, orders: 0, revenue: 0 });
        }
        const day = dailyMap.get(date);
        day.clicks += row.clicks;
        day.orders += row.orders;
        day.revenue += Number(row.revenue);
      });
      const dailyStats = Array.from(dailyMap.values());

      setStats({
        totalClicks,
        totalOrders,
        totalRevenue,
        totalCommission,
        conversionRate,
        topArticles,
        topProducts,
        dailyStats,
      });
    } catch (error) {
      logger.error('Error loading affiliate stats:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading || !stats) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">Loading stats...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Report Importer */}
      <AmazonReportImporter />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClicks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last {dateRange} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.conversionRate.toFixed(2)}% conversion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Product sales value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commission</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalCommission.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Your earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Over Time</CardTitle>
          <CardDescription>Daily clicks and orders for the last {dateRange} days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date), 'MMM d')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                />
                <Line type="monotone" dataKey="clicks" stroke="#8884d8" name="Clicks" />
                <Line type="monotone" dataKey="orders" stroke="#82ca9d" name="Orders" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top Performers */}
      <Tabs defaultValue="articles" className="w-full">
        <TabsList>
          <TabsTrigger value="articles">Top Articles</TabsTrigger>
          <TabsTrigger value="products">Top Products</TabsTrigger>
        </TabsList>

        <TabsContent value="articles">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Articles</CardTitle>
              <CardDescription>Articles generating the most clicks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.topArticles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No article data yet. Click tracking will appear here once users interact with your affiliate links.
                  </p>
                ) : (
                  stats.topArticles.map((article, index) => (
                    <div key={article.article_id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{index + 1}</Badge>
                        <div>
                          <p className="font-medium">{article.article_title}</p>
                          <p className="text-xs text-muted-foreground">
                            {article.clicks} clicks • {article.orders} orders • ${article.revenue.toFixed(2)} revenue
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {((article.orders / article.clicks) * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">CVR</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Products</CardTitle>
              <CardDescription>Products generating the most clicks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No product data yet. Click tracking will appear here once users interact with your affiliate links.
                  </p>
                ) : (
                  stats.topProducts.map((product, index) => (
                    <div key={product.asin} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{index + 1}</Badge>
                        <div>
                          <p className="font-medium">{product.product_title}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.clicks} clicks • {product.orders} orders • ${product.revenue.toFixed(2)} revenue
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {((product.orders / product.clicks) * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">CVR</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};