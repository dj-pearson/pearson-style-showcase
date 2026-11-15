import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, CalendarDays, Wallet, Home } from 'lucide-react';
import { ScheduleCReport } from './ScheduleCReport';
import { QuarterlyTaxTracker } from './QuarterlyTaxTracker';
import { OwnerDrawsTracker } from './OwnerDrawsTracker';
import { HomeOfficeCalculator } from './HomeOfficeCalculator';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfYear, endOfYear } from 'date-fns';
import { fetchAll } from '@/lib/supabase-paging';
import { defaultTaxYear } from '@/lib/accounting/dates';
import { fromCents, toCents } from '@/lib/accounting/money';

export const TaxCenter = () => {
  const [homeOfficeDeduction, setHomeOfficeDeduction] = useState(0);
  // Same default as the Schedule C and quarterly views.
  const taxYear = String(defaultTaxYear());

  const { dateFrom, dateTo } = useMemo(() => {
    const year = parseInt(taxYear);
    const yearDate = new Date(year, 0, 1);
    return {
      dateFrom: format(startOfYear(yearDate), 'yyyy-MM-dd'),
      dateTo: format(endOfYear(yearDate), 'yyyy-MM-dd'),
    };
  }, [taxYear]);

  // Fetch data needed to pass estimated profit to QuarterlyTaxTracker
  const { data: salesInvoices } = useQuery({
    queryKey: ['invoices', 'sales', 'tax-center', dateFrom, dateTo],
    queryFn: () =>
      fetchAll(() =>
        supabase
          .from('invoices')
          .select('amount_paid')
          .eq('invoice_type', 'sales')
          .gte('invoice_date', dateFrom)
          .lte('invoice_date', dateTo)
          .order('id')
      ),
  });

  const { data: purchaseInvoices } = useQuery({
    queryKey: ['invoices', 'purchase', 'tax-center', dateFrom, dateTo],
    queryFn: () =>
      fetchAll(() =>
        supabase
          .from('invoices')
          .select('amount_paid, total_amount')
          .eq('invoice_type', 'purchase')
          .gte('invoice_date', dateFrom)
          .lte('invoice_date', dateTo)
          .order('id')
      ),
  });

  const { data: platformTransactions } = useQuery({
    queryKey: ['platform_transactions', 'tax-center', dateFrom, dateTo],
    queryFn: () =>
      fetchAll(() =>
        supabase
          .from('platform_transactions')
          .select('transaction_type, amount')
          .gte('transaction_date', dateFrom)
          .lte('transaction_date', dateTo)
          .order('id')
      ),
  });

  // Rough estimate of net profit for quarterly tax tracker
  const estimatedData = useMemo(() => {
    let revenue = 0;
    let expenses = 0;

    salesInvoices?.forEach((inv) => {
      revenue += toCents(inv.amount_paid);
    });

    platformTransactions?.forEach((tx) => {
      if (tx.transaction_type === 'revenue') {
        revenue += toCents(tx.amount);
      } else if (tx.transaction_type === 'expense') {
        expenses += toCents(tx.amount);
      }
    });

    purchaseInvoices?.forEach((inv) => {
      expenses += toCents(inv.amount_paid || inv.total_amount);
    });

    // revenue and expenses are whole cents.
    const netProfit = fromCents(revenue - expenses - toCents(homeOfficeDeduction));
    const seNetEarnings = Math.max(0, netProfit * 0.9235);
    const seTax = Math.min(seNetEarnings, 176100) * 0.124 + seNetEarnings * 0.029;

    return { netProfit: Math.max(0, netProfit), seTax };
  }, [salesInvoices, purchaseInvoices, platformTransactions, homeOfficeDeduction]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tax Center</h2>
        <p className="text-muted-foreground">
          Single-Member LLC tax preparation — Schedule C, estimated payments, draws, and deductions
        </p>
      </div>

      <Tabs defaultValue="schedule-c" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="schedule-c" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Schedule C</span>
          </TabsTrigger>
          <TabsTrigger value="quarterly" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Quarterly Estimates</span>
          </TabsTrigger>
          <TabsTrigger value="draws" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Owner's Draws</span>
          </TabsTrigger>
          <TabsTrigger value="home-office" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Home Office</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule-c">
          <ScheduleCReport homeOfficeDeduction={homeOfficeDeduction} />
        </TabsContent>

        <TabsContent value="quarterly">
          <QuarterlyTaxTracker
            estimatedNetProfit={estimatedData.netProfit}
            estimatedSETax={estimatedData.seTax}
          />
        </TabsContent>

        <TabsContent value="draws">
          <OwnerDrawsTracker />
        </TabsContent>

        <TabsContent value="home-office">
          <HomeOfficeCalculator onDeductionChange={setHomeOfficeDeduction} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
