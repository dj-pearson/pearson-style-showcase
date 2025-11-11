import { useState, useEffect } from 'react';
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
import { Plus, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface Account {
  id: string;
  account_number: string | null;
  account_name: string;
  account_type: string;
  account_subtype: string | null;
  is_active: boolean;
  current_balance: number;
}

export const ChartOfAccountsManager = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadAccounts();
  }, [filterType]);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('accounts' as any)
        .select('*')
        .order('account_number', { ascending: true });

      if (filterType !== 'all') {
        query = query.eq('account_type', filterType);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAccounts((data || []) as Account[]);
    } catch (error) {
      logger.error('Error loading accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load accounts',
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

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Asset: 'bg-blue-100 text-blue-800',
      Liability: 'bg-red-100 text-red-800',
      Equity: 'bg-green-100 text-green-800',
      Income: 'bg-emerald-100 text-emerald-800',
      Expense: 'bg-orange-100 text-orange-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Chart of Accounts</CardTitle>
              <CardDescription>
                Manage your account structure for double-entry bookkeeping
              </CardDescription>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('all')}
            >
              All
            </Button>
            <Button
              variant={filterType === 'Asset' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('Asset')}
            >
              Assets
            </Button>
            <Button
              variant={filterType === 'Liability' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('Liability')}
            >
              Liabilities
            </Button>
            <Button
              variant={filterType === 'Equity' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('Equity')}
            >
              Equity
            </Button>
            <Button
              variant={filterType === 'Income' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('Income')}
            >
              Income
            </Button>
            <Button
              variant={filterType === 'Expense' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('Expense')}
            >
              Expenses
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No accounts found</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account #</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subtype</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono">
                        {account.account_number || '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {account.account_name}
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(account.account_type)}>
                          {account.account_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {account.account_subtype || '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(account.current_balance)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.is_active ? 'default' : 'outline'}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </Badge>
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
