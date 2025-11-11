import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface Payment {
  id: string;
  payment_type: 'received' | 'made';
  payment_number: string;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  contacts?: { contact_name: string };
}

export const PaymentsManager = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('payments')
        .select('*, contacts(contact_name)')
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      logger.error('Error loading payments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payments',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payments</CardTitle>
              <CardDescription>
                Track payments received and made
              </CardDescription>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payments recorded</p>
              <p className="text-sm">Record your first payment or import from integrations</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {payment.payment_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant={payment.payment_type === 'received' ? 'default' : 'secondary'}>
                          {payment.payment_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{payment.contacts?.contact_name || '-'}</TableCell>
                      <TableCell>{formatDate(payment.payment_date)}</TableCell>
                      <TableCell>{payment.payment_method || '-'}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
