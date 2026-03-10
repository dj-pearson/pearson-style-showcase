import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { CalendarDays, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, isPast } from 'date-fns';
import { toast } from 'sonner';

const QUARTERLY_DEADLINES: Record<string, { label: string; deadline: string }> = {
  Q1: { label: 'Q1 (Jan–Mar)', deadline: '-04-15' },
  Q2: { label: 'Q2 (Apr–May)', deadline: '-06-16' },
  Q3: { label: 'Q3 (Jun–Aug)', deadline: '-09-15' },
  Q4: { label: 'Q4 (Sep–Dec)', deadline: '-01-15' }, // Due Jan 15 of NEXT year
};

interface QuarterlyTaxTrackerProps {
  estimatedNetProfit?: number;
  estimatedSETax?: number;
}

export const QuarterlyTaxTracker = ({
  estimatedNetProfit = 0,
  estimatedSETax = 0,
}: QuarterlyTaxTrackerProps) => {
  const [taxYear, setTaxYear] = useState('2025');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newPayment, setNewPayment] = useState({
    quarter: 'Q1',
    amount: '',
    datePaid: format(new Date(), 'yyyy-MM-dd'),
    method: 'Bank Transfer',
    confirmationNumber: '',
  });
  const queryClient = useQueryClient();

  // Fetch estimated tax payments for the selected year
  const { data: payments, isLoading } = useQuery({
    queryKey: ['estimated_tax_payments', taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('payment_type', 'made')
        .like('reference_number', `EST-TAX-${taxYear}-%`)
        .order('payment_date');
      if (error) throw error;
      return data;
    },
  });

  // Create a new estimated tax payment
  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      // Generate payment number
      const paymentNumber = `EST-${taxYear}-${newPayment.quarter}`;

      const { error } = await supabase.from('payments').insert({
        payment_type: 'made',
        payment_number: paymentNumber,
        payment_date: newPayment.datePaid,
        amount: parseFloat(newPayment.amount),
        payment_method: newPayment.method,
        reference_number: `EST-TAX-${taxYear}-${newPayment.quarter}`,
        notes: `${newPayment.quarter} ${taxYear} Estimated Tax Payment (Form 1040-ES)${newPayment.confirmationNumber ? ` — Conf: ${newPayment.confirmationNumber}` : ''}`,
        status: 'completed',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimated_tax_payments', taxYear] });
      setIsAddOpen(false);
      setNewPayment({ quarter: 'Q1', amount: '', datePaid: format(new Date(), 'yyyy-MM-dd'), method: 'Bank Transfer', confirmationNumber: '' });
      toast.success('Estimated tax payment recorded');
    },
    onError: () => {
      toast.error('Failed to record payment');
    },
  });

  // Delete a payment
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.from('payments').delete().eq('id', paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimated_tax_payments', taxYear] });
      toast.success('Payment deleted');
    },
  });

  // Group payments by quarter
  const quarterlyData = useMemo(() => {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
      const quarterPayments = payments?.filter(p =>
        p.reference_number?.includes(`-${q}`)
      ) || [];

      const totalPaid = quarterPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      // Calculate deadline
      const deadlineInfo = QUARTERLY_DEADLINES[q];
      let deadlineYear = parseInt(taxYear);
      if (q === 'Q4') deadlineYear += 1; // Q4 due in January of next year
      const deadlineDate = new Date(`${deadlineYear}${deadlineInfo.deadline}`);
      const isOverdue = isPast(deadlineDate) && totalPaid === 0;

      return {
        quarter: q,
        label: deadlineInfo.label,
        deadline: deadlineDate,
        payments: quarterPayments,
        totalPaid,
        isOverdue,
      };
    });

    return quarters;
  }, [payments, taxYear]);

  const totalPaidYTD = quarterlyData.reduce((sum, q) => sum + q.totalPaid, 0);

  // Estimate quarterly payment amount (simple: divide annual liability by 4)
  // Federal income tax estimate (rough: 22% marginal rate for moderate income)
  const estimatedIncomeTax = Math.max(0, estimatedNetProfit * 0.22);
  const totalEstimatedTax = estimatedSETax + estimatedIncomeTax;
  const suggestedQuarterlyPayment = totalEstimatedTax / 4;
  const remainingLiability = Math.max(0, totalEstimatedTax - totalPaidYTD);

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
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Estimated Annual Tax</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totalEstimatedTax)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              SE tax + est. income tax on {formatCurrency(estimatedNetProfit)} net profit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Suggested Per Quarter</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(suggestedQuarterlyPayment)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Annual estimate ÷ 4</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Paid YTD</CardDescription>
            <CardTitle className="text-2xl text-green-700">{formatCurrency(totalPaidYTD)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {quarterlyData.filter(q => q.totalPaid > 0).length} of 4 quarters paid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Remaining Liability</CardDescription>
            <CardTitle className={`text-2xl ${remainingLiability > 0 ? 'text-red-700' : 'text-green-700'}`}>
              {formatCurrency(remainingLiability)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {remainingLiability <= 0 ? 'Fully covered' : 'Still owed'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quarterly Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Quarterly Estimated Payments (Form 1040-ES)</CardTitle>
              <CardDescription>Track your quarterly estimated tax payments to the IRS</CardDescription>
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
                    Record Payment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Estimated Tax Payment</DialogTitle>
                    <DialogDescription>
                      Record a Form 1040-ES payment made to the IRS
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Quarter</Label>
                      <Select
                        value={newPayment.quarter}
                        onValueChange={(v) => setNewPayment(prev => ({ ...prev, quarter: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(QUARTERLY_DEADLINES).map(([q, info]) => (
                            <SelectItem key={q} value={q}>{info.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Amount Paid</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newPayment.amount}
                        onChange={(e) => setNewPayment(prev => ({ ...prev, amount: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Date Paid</Label>
                      <Input
                        type="date"
                        value={newPayment.datePaid}
                        onChange={(e) => setNewPayment(prev => ({ ...prev, datePaid: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Payment Method</Label>
                      <Select
                        value={newPayment.method}
                        onValueChange={(v) => setNewPayment(prev => ({ ...prev, method: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Bank Transfer">Bank Transfer (EFTPS)</SelectItem>
                          <SelectItem value="Credit Card">Credit Card</SelectItem>
                          <SelectItem value="Check">Check</SelectItem>
                          <SelectItem value="IRS Direct Pay">IRS Direct Pay</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Confirmation Number (optional)</Label>
                      <Input
                        placeholder="e.g., IRS confirmation #"
                        value={newPayment.confirmationNumber}
                        onChange={(e) => setNewPayment(prev => ({ ...prev, confirmationNumber: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                    <Button
                      onClick={() => createPaymentMutation.mutate()}
                      disabled={!newPayment.amount || createPaymentMutation.isPending}
                    >
                      {createPaymentMutation.isPending ? 'Saving...' : 'Record Payment'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quarter</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount Paid</TableHead>
                <TableHead>Date Paid</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quarterlyData.map(q => (
                q.payments.length > 0 ? (
                  q.payments.map((payment, idx) => (
                    <TableRow key={payment.id}>
                      {idx === 0 && (
                        <>
                          <TableCell rowSpan={q.payments.length} className="font-medium">
                            {q.label}
                          </TableCell>
                          <TableCell rowSpan={q.payments.length}>
                            {format(q.deadline, 'MMM d, yyyy')}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Paid
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(Number(payment.amount))}
                      </TableCell>
                      <TableCell>{format(new Date(payment.payment_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{payment.payment_method}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            if (confirm('Delete this payment record?')) {
                              deletePaymentMutation.mutate(payment.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow key={q.quarter}>
                    <TableCell className="font-medium">{q.label}</TableCell>
                    <TableCell>{format(q.deadline, 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      {q.isOverdue ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Overdue
                        </Badge>
                      ) : (
                        <Badge variant="outline">Unpaid</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">—</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )
              ))}
              <TableRow className="font-semibold bg-muted">
                <TableCell colSpan={3}>Total Paid</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(totalPaidYTD)}</TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {estimatedNetProfit > 0 && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                <CalendarDays className="h-4 w-4 inline mr-1" />
                Safe Harbor Rule
              </p>
              <p className="text-blue-800 dark:text-blue-200">
                To avoid underpayment penalties, pay at least 100% of your prior year tax liability
                (110% if AGI &gt; $150K) or 90% of your current year liability, whichever is less.
                These estimates are based on current-year projected income.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
