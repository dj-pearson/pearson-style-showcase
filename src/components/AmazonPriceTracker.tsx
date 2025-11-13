import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingDown, TrendingUp, Minus, Bell, BellOff, DollarSign } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface PricePoint {
  recorded_at: string;
  price: number;
  availability: string;
}

interface PriceStats {
  lowest_price: number;
  highest_price: number;
  average_price: number;
  median_price: number;
  data_points: number;
}

interface AmazonPriceTrackerProps {
  asin: string;
  currentPrice?: number;
  productTitle?: string;
}

const AmazonPriceTracker = ({ asin, currentPrice, productTitle }: AmazonPriceTrackerProps) => {
  const [alertEmail, setAlertEmail] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch price history
  const { data: priceHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['price-history', asin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amazon_price_history')
        .select('recorded_at, price, availability')
        .eq('asin', asin)
        .order('recorded_at', { ascending: true });

      if (error) throw error;
      return data as PricePoint[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch price statistics
  const { data: priceStats } = useQuery({
    queryKey: ['price-stats', asin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amazon_price_stats')
        .select('*')
        .eq('asin', asin)
        .single();

      if (error) throw error;
      return data as PriceStats;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Check if user has active alerts
  const { data: userAlerts } = useQuery({
    queryKey: ['price-alerts', asin, alertEmail],
    queryFn: async () => {
      if (!alertEmail) return [];

      const { data, error } = await supabase
        .from('amazon_price_alerts')
        .select('*')
        .eq('asin', asin)
        .eq('user_email', alertEmail)
        .eq('is_active', true);

      if (error) throw error;
      return data;
    },
    enabled: !!alertEmail,
  });

  // Create price alert mutation
  const createAlertMutation = useMutation({
    mutationFn: async () => {
      if (!alertEmail || !targetPrice) {
        throw new Error('Email and target price are required');
      }

      const { data, error } = await supabase
        .from('amazon_price_alerts')
        .insert({
          asin,
          user_email: alertEmail,
          target_price: parseFloat(targetPrice),
          current_price: currentPrice,
          alert_type: 'below',
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-alerts'] });
      toast.success('Price alert created!', {
        description: `You'll be notified when the price drops to $${targetPrice}`,
      });
      setIsAlertDialogOpen(false);
      setTargetPrice('');
    },
    onError: (error) => {
      toast.error('Failed to create alert', {
        description: error.message,
      });
    },
  });

  // Calculate price trend
  const getPriceTrend = () => {
    if (!priceHistory || priceHistory.length < 2) return 'stable';

    const recentPrices = priceHistory.slice(-7);
    const olderPrices = priceHistory.slice(-14, -7);

    if (recentPrices.length === 0 || olderPrices.length === 0) return 'stable';

    const recentAvg = recentPrices.reduce((sum, p) => sum + p.price, 0) / recentPrices.length;
    const olderAvg = olderPrices.reduce((sum, p) => sum + p.price, 0) / olderPrices.length;

    if (recentAvg < olderAvg * 0.95) return 'down';
    if (recentAvg > olderAvg * 1.05) return 'up';
    return 'stable';
  };

  const trend = getPriceTrend();

  // Format chart data
  const chartData = priceHistory?.map(point => ({
    date: new Date(point.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    price: parseFloat(point.price.toString()),
  })) || [];

  // Calculate savings if there's a lowest price
  const potentialSavings = currentPrice && priceStats?.lowest_price
    ? currentPrice - priceStats.lowest_price
    : 0;

  const savingsPercentage = currentPrice && priceStats?.lowest_price
    ? ((potentialSavings / currentPrice) * 100).toFixed(0)
    : 0;

  if (isLoadingHistory) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!priceHistory || priceHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price History</CardTitle>
          <CardDescription>No price history available yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Price History
              {trend === 'down' && (
                <Badge variant="default" className="bg-green-500">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  Trending Down
                </Badge>
              )}
              {trend === 'up' && (
                <Badge variant="destructive">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Trending Up
                </Badge>
              )}
              {trend === 'stable' && (
                <Badge variant="secondary">
                  <Minus className="w-3 h-3 mr-1" />
                  Stable
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {priceHistory.length} price points tracked
            </CardDescription>
          </div>

          {/* Price Alert Button */}
          <Dialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                {userAlerts && userAlerts.length > 0 ? (
                  <>
                    <BellOff className="w-4 h-4 mr-2" />
                    Alert Active
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Set Alert
                  </>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Set Price Alert</DialogTitle>
                <DialogDescription>
                  Get notified when the price drops to your target price
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-price">Target Price (USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="target-price"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {priceStats && (
                    <p className="text-xs text-muted-foreground">
                      Lowest recorded: ${priceStats.lowest_price.toFixed(2)}
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => createAlertMutation.mutate()}
                  disabled={!alertEmail || !targetPrice || createAlertMutation.isPending}
                  className="w-full"
                >
                  {createAlertMutation.isPending ? 'Creating...' : 'Create Alert'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Price Statistics */}
        {priceStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Lowest</p>
              <p className="text-lg font-bold text-green-500">
                ${priceStats.lowest_price.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Highest</p>
              <p className="text-lg font-bold text-red-500">
                ${priceStats.highest_price.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Average</p>
              <p className="text-lg font-bold">
                ${priceStats.average_price.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Current</p>
              <p className="text-lg font-bold">
                ${currentPrice?.toFixed(2) || 'N/A'}
              </p>
            </div>
          </div>
        )}

        {/* Savings Alert */}
        {potentialSavings > 0 && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-green-500">
                  Save ${potentialSavings.toFixed(2)} ({savingsPercentage}%)
                </p>
                <p className="text-sm text-muted-foreground">
                  Compared to lowest recorded price
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Price Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00b4d8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00b4d8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                dataKey="date"
                stroke="#888"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="#888"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#00b4d8"
                strokeWidth={2}
                fill="url(#priceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Chart Legend */}
        <p className="text-xs text-center text-muted-foreground">
          Price trend over the last {priceHistory.length} days
        </p>
      </CardContent>
    </Card>
  );
};

export default AmazonPriceTracker;
