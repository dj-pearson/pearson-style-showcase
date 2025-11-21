import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Receipt, Trash2, Edit, Check, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { format } from 'date-fns';

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  reference_number: string | null;
  notes: string | null;
  status: string;
  posted_at: string | null;
  created_at: string | null;
}

interface JournalEntryLine {
  id?: string;
  account_id: string;
  description: string | null;
  debit: number | null;
  credit: number | null;
  line_number: number;
}

interface Account {
  id: string;
  account_number: string;
  account_name: string;
  account_type: string;
}

interface JournalEntryWithLines extends JournalEntry {
  journal_entry_lines?: JournalEntryLine[];
}

export const JournalEntriesManager = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntryWithLines | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

  // Form state
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<JournalEntryLine[]>([
    { account_id: '', description: '', debit: null, credit: null, line_number: 1 },
    { account_id: '', description: '', debit: null, credit: null, line_number: 2 },
  ]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch journal entries with lines
  const { data: entries, isLoading } = useQuery({
    queryKey: ['journal_entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select(`
          *,
          journal_entry_lines (
            id,
            account_id,
            description,
            debit,
            credit,
            line_number,
            accounts (
              id,
              account_number,
              account_name
            )
          )
        `)
        .order('entry_date', { ascending: false });

      if (error) {
        logger.error('Error fetching journal entries:', error);
        throw error;
      }

      return data as JournalEntryWithLines[];
    },
  });

  // Fetch accounts for dropdown
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, account_number, account_name, account_type')
        .eq('is_active', true)
        .order('account_number');

      if (error) {
        logger.error('Error fetching accounts:', error);
        throw error;
      }

      return data as Account[];
    },
  });

  // Generate next entry number
  const generateEntryNumber = async () => {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('entry_number')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      logger.error('Error generating entry number:', error);
      return 'JE-0001';
    }

    if (!data || data.length === 0) {
      return 'JE-0001';
    }

    const lastNumber = data[0].entry_number.split('-').pop();
    const nextNumber = (parseInt(lastNumber || '0') + 1).toString().padStart(4, '0');
    return `JE-${nextNumber}`;
  };

  // Create journal entry mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      // Validate balance
      const totalDebits = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
      const totalCredits = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error('Debits and credits must be equal');
      }

      // Validate at least 2 lines
      const validLines = lines.filter(line => line.account_id && (line.debit || line.credit));
      if (validLines.length < 2) {
        throw new Error('Journal entry must have at least 2 lines');
      }

      const entryNumber = await generateEntryNumber();

      // Insert journal entry header
      const { data: entry, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: entryDate,
          reference_number: referenceNumber || null,
          notes: notes || null,
          status: 'draft',
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // Insert journal entry lines
      const linesToInsert = validLines.map((line, index) => ({
        journal_entry_id: entry.id,
        account_id: line.account_id,
        description: line.description || null,
        debit: line.debit || null,
        credit: line.credit || null,
        line_number: index + 1,
      }));

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(linesToInsert);

      if (linesError) throw linesError;

      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal_entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({
        title: 'Success',
        description: 'Journal entry created successfully',
      });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      logger.error('Error creating journal entry:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create journal entry',
        variant: 'destructive',
      });
    },
  });

  // Update journal entry mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEntry) return;

      // Validate balance
      const totalDebits = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
      const totalCredits = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error('Debits and credits must be equal');
      }

      // Can't edit posted entries
      if (selectedEntry.status === 'posted') {
        throw new Error('Cannot edit posted journal entries');
      }

      // Update journal entry header
      const { error: entryError } = await supabase
        .from('journal_entries')
        .update({
          entry_date: entryDate,
          reference_number: referenceNumber || null,
          notes: notes || null,
        })
        .eq('id', selectedEntry.id);

      if (entryError) throw entryError;

      // Delete existing lines
      const { error: deleteError } = await supabase
        .from('journal_entry_lines')
        .delete()
        .eq('journal_entry_id', selectedEntry.id);

      if (deleteError) throw deleteError;

      // Insert new lines
      const validLines = lines.filter(line => line.account_id && (line.debit || line.credit));
      const linesToInsert = validLines.map((line, index) => ({
        journal_entry_id: selectedEntry.id,
        account_id: line.account_id,
        description: line.description || null,
        debit: line.debit || null,
        credit: line.credit || null,
        line_number: index + 1,
      }));

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(linesToInsert);

      if (linesError) throw linesError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal_entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({
        title: 'Success',
        description: 'Journal entry updated successfully',
      });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      logger.error('Error updating journal entry:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update journal entry',
        variant: 'destructive',
      });
    },
  });

  // Post journal entry mutation
  const postMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const entry = entries?.find(e => e.id === entryId);
      if (!entry) throw new Error('Entry not found');

      if (entry.status === 'posted') {
        throw new Error('Entry is already posted');
      }

      // Validate balance
      const totalDebits = (entry.journal_entry_lines || []).reduce(
        (sum, line) => sum + (Number(line.debit) || 0), 0
      );
      const totalCredits = (entry.journal_entry_lines || []).reduce(
        (sum, line) => sum + (Number(line.credit) || 0), 0
      );

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error('Cannot post unbalanced entry');
      }

      const { error } = await supabase
        .from('journal_entries')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
        })
        .eq('id', entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal_entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({
        title: 'Success',
        description: 'Journal entry posted successfully',
      });
    },
    onError: (error: Error) => {
      logger.error('Error posting journal entry:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to post journal entry',
        variant: 'destructive',
      });
    },
  });

  // Void journal entry mutation
  const voidMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('journal_entries')
        .update({
          status: 'void',
        })
        .eq('id', entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal_entries'] });
      toast({
        title: 'Success',
        description: 'Journal entry voided successfully',
      });
    },
    onError: (error: Error) => {
      logger.error('Error voiding journal entry:', error);
      toast({
        title: 'Error',
        description: 'Failed to void journal entry',
        variant: 'destructive',
      });
    },
  });

  // Delete journal entry mutation
  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const entry = entries?.find(e => e.id === entryId);
      if (entry?.status === 'posted') {
        throw new Error('Cannot delete posted entries. Void them instead.');
      }

      // Delete lines first (cascade should handle this, but being explicit)
      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .delete()
        .eq('journal_entry_id', entryId);

      if (linesError) throw linesError;

      // Delete entry
      const { error: entryError } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', entryId);

      if (entryError) throw entryError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal_entries'] });
      toast({
        title: 'Success',
        description: 'Journal entry deleted successfully',
      });
      setIsDeleteDialogOpen(false);
      setEntryToDelete(null);
    },
    onError: (error: Error) => {
      logger.error('Error deleting journal entry:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete journal entry',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setEntryDate(format(new Date(), 'yyyy-MM-dd'));
    setReferenceNumber('');
    setNotes('');
    setLines([
      { account_id: '', description: '', debit: null, credit: null, line_number: 1 },
      { account_id: '', description: '', debit: null, credit: null, line_number: 2 },
    ]);
    setSelectedEntry(null);
  };

  const handleEdit = (entry: JournalEntryWithLines) => {
    if (entry.status === 'posted') {
      toast({
        title: 'Cannot Edit',
        description: 'Posted entries cannot be edited. You can void them instead.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedEntry(entry);
    setEntryDate(entry.entry_date);
    setReferenceNumber(entry.reference_number || '');
    setNotes(entry.notes || '');

    if (entry.journal_entry_lines && entry.journal_entry_lines.length > 0) {
      setLines(entry.journal_entry_lines.map((line, index) => ({
        id: line.id,
        account_id: line.account_id,
        description: line.description || '',
        debit: line.debit,
        credit: line.credit,
        line_number: index + 1,
      })));
    }

    setIsDialogOpen(true);
  };

  const handleView = (entry: JournalEntryWithLines) => {
    setSelectedEntry(entry);
    setIsViewDialogOpen(true);
  };

  const handleDelete = (entryId: string) => {
    setEntryToDelete(entryId);
    setIsDeleteDialogOpen(true);
  };

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        account_id: '',
        description: '',
        debit: null,
        credit: null,
        line_number: lines.length + 1,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) {
      toast({
        title: 'Cannot Remove',
        description: 'Journal entry must have at least 2 lines',
        variant: 'destructive',
      });
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof JournalEntryLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const calculateBalance = () => {
    const totalDebits = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
    const totalCredits = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
    return {
      debits: totalDebits,
      credits: totalCredits,
      difference: totalDebits - totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
    };
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return format(new Date(date), 'MMM d, yyyy');
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: any }> = {
      posted: { variant: 'default', icon: CheckCircle2 },
      draft: { variant: 'outline', icon: Edit },
      void: { variant: 'destructive', icon: X },
    };

    const config = variants[status] || { variant: 'outline' as const, icon: AlertCircle };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {status.toUpperCase()}
      </Badge>
    );
  };

  const balance = calculateBalance();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Journal Entries</CardTitle>
              <CardDescription>
                Manual double-entry bookkeeping transactions
              </CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Entry
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !entries || entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No journal entries</p>
              <p className="text-sm">Create manual journal entries for bookkeeping adjustments</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entry #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {entry.entry_number}
                      </TableCell>
                      <TableCell>{formatDate(entry.entry_date)}</TableCell>
                      <TableCell>{entry.reference_number || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {entry.notes || '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(entry.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(entry)}
                          >
                            View
                          </Button>
                          {entry.status === 'draft' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(entry)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => postMutation.mutate(entry.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(entry.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                          {entry.status === 'posted' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => voidMutation.mutate(entry.id)}
                            >
                              Void
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEntry ? 'Edit Journal Entry' : 'New Journal Entry'}
            </DialogTitle>
            <DialogDescription>
              Create manual double-entry bookkeeping transactions. Debits must equal credits.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="entry_date">Entry Date</Label>
                <Input
                  id="entry_date"
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference_number">Reference Number</Label>
                <Input
                  id="reference_number"
                  placeholder="Optional reference"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Journal entry description"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddLine}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Account</TableHead>
                      <TableHead className="w-[25%]">Description</TableHead>
                      <TableHead className="w-[15%] text-right">Debit</TableHead>
                      <TableHead className="w-[15%] text-right">Credit</TableHead>
                      <TableHead className="w-[5%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Select
                            value={line.account_id}
                            onValueChange={(value) => handleLineChange(index, 'account_id', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts?.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.account_number} - {account.account_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Description"
                            value={line.description || ''}
                            onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={line.debit || ''}
                            onChange={(e) => handleLineChange(index, 'debit', e.target.value ? parseFloat(e.target.value) : null)}
                            className="text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={line.credit || ''}
                            onChange={(e) => handleLineChange(index, 'credit', e.target.value ? parseFloat(e.target.value) : null)}
                            className="text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveLine(index)}
                            disabled={lines.length <= 2}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Balance Summary */}
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Total Debits:</span>
                  <span className="font-mono">{formatCurrency(balance.debits)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Total Credits:</span>
                  <span className="font-mono">{formatCurrency(balance.credits)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t">
                  <span className="flex items-center gap-2">
                    Difference:
                    {balance.isBalanced ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                  </span>
                  <span className={`font-mono ${balance.isBalanced ? 'text-green-600' : 'text-destructive'}`}>
                    {formatCurrency(Math.abs(balance.difference))}
                  </span>
                </div>
                {!balance.isBalanced && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Entry must be balanced before saving
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedEntry ? updateMutation.mutate() : createMutation.mutate()}
              disabled={!balance.isBalanced || createMutation.isPending || updateMutation.isPending}
            >
              {selectedEntry ? 'Update' : 'Create'} Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Journal Entry Details</DialogTitle>
            <DialogDescription>
              Entry #{selectedEntry?.entry_number}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Date:</span> {formatDate(selectedEntry.entry_date)}
                </div>
                <div>
                  <span className="font-medium">Reference:</span> {selectedEntry.reference_number || '-'}
                </div>
                <div className="col-span-2">
                  <span className="font-medium">Status:</span> {getStatusBadge(selectedEntry.status)}
                </div>
                {selectedEntry.notes && (
                  <div className="col-span-2">
                    <span className="font-medium">Notes:</span> {selectedEntry.notes}
                  </div>
                )}
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedEntry.journal_entry_lines?.map((line: any) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          {line.accounts?.account_number} - {line.accounts?.account_name}
                        </TableCell>
                        <TableCell>{line.description || '-'}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(line.debit)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(line.credit)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted">
                      <TableCell colSpan={2}>Totals</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(
                          selectedEntry.journal_entry_lines?.reduce(
                            (sum: number, line: any) => sum + (Number(line.debit) || 0), 0
                          ) || 0
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(
                          selectedEntry.journal_entry_lines?.reduce(
                            (sum: number, line: any) => sum + (Number(line.credit) || 0), 0
                          ) || 0
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Journal Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the journal entry
              and all associated line items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEntryToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => entryToDelete && deleteMutation.mutate(entryToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
