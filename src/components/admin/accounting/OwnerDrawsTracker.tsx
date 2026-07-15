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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Trash2, Wallet, TrendingDown, Info } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

export const OwnerDrawsTracker = () => {
  const [taxYear, setTaxYear] = useState(new Date().getFullYear().toString());
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newDraw, setNewDraw] = useState({
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    method: 'Bank Transfer',
    description: '',
  });
  const queryClient = useQueryClient();

  // Fetch owner draw payments
  const { data: draws } = useQuery({
    queryKey: ['owner_draws', taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('payment_type', 'made')
        .like('reference_number', `OWNER-DRAW-${taxYear}-%`)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create a new draw
  const createDrawMutation = useMutation({
    mutationFn: async () => {
      // Generate sequential number
      const existingCount = draws?.length || 0;
      const seq = String(existingCount + 1).padStart(3, '0');

      const { error } = await supabase.from('payments').insert({
        payment_type: 'made',
        payment_number: `DRAW-${taxYear}-${seq}`,
        payment_date: newDraw.date,
        amount: parseFloat(newDraw.amount),
        payment_method: newDraw.method,
        reference_number: `OWNER-DRAW-${taxYear}-${seq}`,
        notes: newDraw.description || `Owner's distribution — ${format(new Date(newDraw.date), 'MMM yyyy')}`,
        status: 'completed',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner_draws', taxYear] });
      setIsAddOpen(false);
      setNewDraw({ amount: '', date: format(new Date(), 'yyyy-MM-dd'), method: 'Bank Transfer', description: '' });
      toast.success("Owner's draw recorded");
    },
    onError: () => {
      toast.error('Failed to record draw');
    },
  });

  // Delete a draw
  const deleteDrawMutation = useMutation({
    mutationFn: async (drawId: string) => {
      const { error } = await supabase.from('payments').delete().eq('id', drawId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner_draws', taxYear] });
      toast.success('Draw deleted');
    },
  });

  // Calculate totals
  const totalDrawsYTD = draws?.reduce((sum, d) => sum + Number(d.amount || 0), 0) || 0;

  // Monthly breakdown
  const monthlyBreakdown = useMemo(() => {
    const months: Record<string, number> = {};
    draws?.forEach(draw => {
      const monthKey = format(new Date(draw.payment_date), 'yyyy-MM');
      months[monthKey] = (months[monthKey] || 0) + Number(draw.amount || 0);
    });

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({
        month: format(new Date(month + '-01'), 'MMM yyyy'),
        amount,
      }));
  }, [draws]);

  const avgMonthlyDraw = monthlyBreakdown.length > 0
    ? totalDrawsYTD / monthlyBreakdown.length
    : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Owner's Draws vs. Salary</p>
            <p>
              Single-member LLCs (disregarded entities) don't pay salary to the owner.
              Instead, you take <strong>owner's draws</strong> (distributions).
              Draws are <strong>not tax-deductible expenses</strong> — they reduce equity, not profit.
              You pay taxes on the LLC's net profit regardless of how much you draw.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Draws ({taxYear})</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totalDrawsYTD)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {draws?.length || 0} distribution{(draws?.length || 0) !== 1 ? 's' : ''} recorded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Monthly Draw</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(avgMonthlyDraw)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Based on {monthlyBreakdown.length} month{monthlyBreakdown.length !== 1 ? 's' : ''} with draws
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Draw</CardDescription>
            <CardTitle className="text-2xl">
              {draws && draws.length > 0
                ? formatCurrency(Number(draws[0].amount))
                : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {draws && draws.length > 0
                ? format(new Date(draws[0].payment_date), 'MMM d, yyyy')
                : 'No draws recorded'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Draws List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Owner's Distributions
              </CardTitle>
              <CardDescription>Track money you've taken out of the business</CardDescription>
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

              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Record Draw
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Owner's Draw</DialogTitle>
                    <DialogDescription>
                      Record a distribution taken from the business
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newDraw.amount}
                        onChange={(e) => setNewDraw(prev => ({ ...prev, amount: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={newDraw.date}
                        onChange={(e) => setNewDraw(prev => ({ ...prev, date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Method</Label>
                      <Select
                        value={newDraw.method}
                        onValueChange={(v) => setNewDraw(prev => ({ ...prev, method: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                          <SelectItem value="Check">Check</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Description (optional)</Label>
                      <Input
                        placeholder="e.g., Monthly owner distribution"
                        value={newDraw.description}
                        onChange={(e) => setNewDraw(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                    <Button
                      onClick={() => createDrawMutation.mutate()}
                      disabled={!newDraw.amount || createDrawMutation.isPending}
                    >
                      {createDrawMutation.isPending ? 'Saving...' : 'Record Draw'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {draws && draws.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draws.map(draw => (
                  <TableRow key={draw.id}>
                    <TableCell>{format(new Date(draw.payment_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {draw.notes || "Owner's distribution"}
                    </TableCell>
                    <TableCell className="text-sm">{draw.payment_method}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(Number(draw.amount))}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          if (confirm('Delete this draw record?')) {
                            deleteDrawMutation.mutate(draw.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-muted">
                  <TableCell colSpan={3}>Total Draws ({taxYear})</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totalDrawsYTD)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Draws Recorded</p>
              <p className="text-sm">
                Record owner distributions to track how much you've taken from the business in {taxYear}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Breakdown */}
      {monthlyBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Monthly Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Total Draws</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyBreakdown.map(({ month, amount }) => (
                  <TableRow key={month}>
                    <TableCell>{month}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
