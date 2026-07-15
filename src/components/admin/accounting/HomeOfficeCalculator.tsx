import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { Home, Info, Download, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

const SIMPLIFIED_RATE = 5; // $5 per square foot
const SIMPLIFIED_MAX_SQFT = 300; // Max 300 sq ft
const SIMPLIFIED_MAX_DEDUCTION = SIMPLIFIED_RATE * SIMPLIFIED_MAX_SQFT; // $1,500

interface HomeOfficeCalculatorProps {
  onDeductionChange?: (amount: number) => void;
}

export const HomeOfficeCalculator = ({ onDeductionChange }: HomeOfficeCalculatorProps) => {
  const [method, setMethod] = useState('simplified');

  // Simplified method inputs
  const [officeSqFt, setOfficeSqFt] = useState('');

  // Actual method inputs
  const [totalHomeSqFt, setTotalHomeSqFt] = useState('');
  const [actualOfficeSqFt, setActualOfficeSqFt] = useState('');
  const [expenses, setExpenses] = useState({
    mortgageRent: '',
    utilities: '',
    insurance: '',
    repairs: '',
    depreciation: '',
    propertyTax: '',
    mortgageInterest: '',
    other: '',
  });

  // Simplified method calculation
  const simplifiedDeduction = useMemo(() => {
    const sqft = Math.min(parseFloat(officeSqFt) || 0, SIMPLIFIED_MAX_SQFT);
    return sqft * SIMPLIFIED_RATE;
  }, [officeSqFt]);

  // Actual method calculation
  const actualDeduction = useMemo(() => {
    const total = parseFloat(totalHomeSqFt) || 0;
    const office = parseFloat(actualOfficeSqFt) || 0;
    if (total === 0 || office === 0) return { percentage: 0, deduction: 0, totalExpenses: 0 };

    const percentage = Math.min(office / total, 1);

    // Direct expenses (100% deductible) - repairs specific to office
    const directExpenses = parseFloat(expenses.repairs) || 0;

    // Indirect expenses (proportional to office percentage)
    const indirectTotal =
      (parseFloat(expenses.mortgageRent) || 0) +
      (parseFloat(expenses.utilities) || 0) +
      (parseFloat(expenses.insurance) || 0) +
      (parseFloat(expenses.depreciation) || 0) +
      (parseFloat(expenses.propertyTax) || 0) +
      (parseFloat(expenses.mortgageInterest) || 0) +
      (parseFloat(expenses.other) || 0);

    const indirectDeduction = indirectTotal * percentage;
    const totalExpenses = directExpenses + indirectTotal;
    const deduction = directExpenses + indirectDeduction;

    return { percentage, deduction, totalExpenses };
  }, [totalHomeSqFt, actualOfficeSqFt, expenses]);

  const currentDeduction = method === 'simplified' ? simplifiedDeduction : actualDeduction.deduction;

  // Notify parent of deduction change
  const handleApplyDeduction = () => {
    onDeductionChange?.(currentDeduction);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleExport = () => {
    const lines: string[] = [];
    lines.push('Home Office Deduction Calculation');
    lines.push(`Generated: ${format(new Date(), 'MMM d, yyyy')}`);
    lines.push(`Method: ${method === 'simplified' ? 'Simplified' : 'Actual Expense'}`);
    lines.push('');

    if (method === 'simplified') {
      lines.push(`Office square footage,${officeSqFt}`);
      lines.push(`Rate per sq ft,$${SIMPLIFIED_RATE}`);
      lines.push(`Maximum sq ft,${SIMPLIFIED_MAX_SQFT}`);
      lines.push(`Deduction,${simplifiedDeduction.toFixed(2)}`);
    } else {
      lines.push(`Total home square footage,${totalHomeSqFt}`);
      lines.push(`Office square footage,${actualOfficeSqFt}`);
      lines.push(`Business use percentage,${(actualDeduction.percentage * 100).toFixed(1)}%`);
      lines.push('');
      lines.push('Expenses:');
      lines.push(`Mortgage/Rent,${expenses.mortgageRent || '0'}`);
      lines.push(`Utilities,${expenses.utilities || '0'}`);
      lines.push(`Insurance,${expenses.insurance || '0'}`);
      lines.push(`Repairs (office-specific),${expenses.repairs || '0'}`);
      lines.push(`Depreciation,${expenses.depreciation || '0'}`);
      lines.push(`Property Tax,${expenses.propertyTax || '0'}`);
      lines.push(`Mortgage Interest,${expenses.mortgageInterest || '0'}`);
      lines.push(`Other,${expenses.other || '0'}`);
      lines.push('');
      lines.push(`Total Deduction,${actualDeduction.deduction.toFixed(2)}`);
    }

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `home-office-deduction-${format(new Date(), 'yyyy')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Home Office Deduction (Form 8829 / Schedule C Line 30)</p>
            <p>
              If you use part of your home <strong>regularly and exclusively</strong> for business,
              you can deduct home office expenses. Choose between the <strong>Simplified Method</strong> ($5/sq ft,
              max 300 sq ft = $1,500) or the <strong>Actual Expense Method</strong> (percentage of actual
              home expenses based on office square footage).
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Home Office Deduction Calculator
              </CardTitle>
              <CardDescription>
                Calculate your home office deduction for Schedule C Line 30
              </CardDescription>
            </div>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={method} onValueChange={setMethod} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="simplified">Simplified Method</TabsTrigger>
              <TabsTrigger value="actual">Actual Expense Method</TabsTrigger>
            </TabsList>

            {/* Simplified Method */}
            <TabsContent value="simplified" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Office Square Footage</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 200"
                    value={officeSqFt}
                    onChange={(e) => setOfficeSqFt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum {SIMPLIFIED_MAX_SQFT} sq ft allowed
                  </p>
                </div>
                <div>
                  <Label>Rate per Square Foot</Label>
                  <Input value={`$${SIMPLIFIED_RATE}.00`} disabled />
                  <p className="text-xs text-muted-foreground mt-1">
                    IRS fixed rate for simplified method
                  </p>
                </div>
              </div>

              <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <CardContent className="pt-6">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell>Office area</TableCell>
                        <TableCell className="text-right font-mono">
                          {Math.min(parseFloat(officeSqFt) || 0, SIMPLIFIED_MAX_SQFT)} sq ft
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Rate</TableCell>
                        <TableCell className="text-right font-mono">
                          × ${SIMPLIFIED_RATE}.00/sq ft
                        </TableCell>
                      </TableRow>
                      <TableRow className="font-bold text-lg">
                        <TableCell>Deduction (Schedule C Line 30)</TableCell>
                        <TableCell className="text-right font-mono text-green-700">
                          {formatCurrency(simplifiedDeduction)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  {parseFloat(officeSqFt) > SIMPLIFIED_MAX_SQFT && (
                    <p className="text-xs text-amber-700 mt-2">
                      Capped at {SIMPLIFIED_MAX_SQFT} sq ft ({formatCurrency(SIMPLIFIED_MAX_DEDUCTION)} max).
                      Consider the Actual Expense Method for larger offices.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Actual Expense Method */}
            <TabsContent value="actual" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Total Home Square Footage</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 2000"
                    value={totalHomeSqFt}
                    onChange={(e) => setTotalHomeSqFt(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Office Square Footage</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 250"
                    value={actualOfficeSqFt}
                    onChange={(e) => setActualOfficeSqFt(e.target.value)}
                  />
                </div>
              </div>

              {actualDeduction.percentage > 0 && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <strong>Business Use Percentage:</strong>{' '}
                  {(actualDeduction.percentage * 100).toFixed(1)}%
                  ({actualOfficeSqFt} ÷ {totalHomeSqFt} sq ft)
                </div>
              )}

              <div>
                <h3 className="font-medium mb-3">Annual Home Expenses</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Mortgage or Rent</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Annual total"
                      value={expenses.mortgageRent}
                      onChange={(e) => setExpenses(prev => ({ ...prev, mortgageRent: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Utilities (electric, gas, water, internet)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Annual total"
                      value={expenses.utilities}
                      onChange={(e) => setExpenses(prev => ({ ...prev, utilities: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Homeowner's / Renter's Insurance</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Annual total"
                      value={expenses.insurance}
                      onChange={(e) => setExpenses(prev => ({ ...prev, insurance: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Repairs & Maintenance (office-specific)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Direct to office (100% deductible)"
                      value={expenses.repairs}
                      onChange={(e) => setExpenses(prev => ({ ...prev, repairs: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Property Tax</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Annual total"
                      value={expenses.propertyTax}
                      onChange={(e) => setExpenses(prev => ({ ...prev, propertyTax: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Mortgage Interest</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Annual total"
                      value={expenses.mortgageInterest}
                      onChange={(e) => setExpenses(prev => ({ ...prev, mortgageInterest: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Depreciation (home only)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Annual depreciation"
                      value={expenses.depreciation}
                      onChange={(e) => setExpenses(prev => ({ ...prev, depreciation: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Other Expenses</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Security, HOA, etc."
                      value={expenses.other}
                      onChange={(e) => setExpenses(prev => ({ ...prev, other: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <CardContent className="pt-6">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell>Total home expenses</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(actualDeduction.totalExpenses)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Business use percentage</TableCell>
                        <TableCell className="text-right font-mono">
                          × {(actualDeduction.percentage * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Office-specific repairs (100%)</TableCell>
                        <TableCell className="text-right font-mono">
                          + {formatCurrency(parseFloat(expenses.repairs) || 0)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="font-bold text-lg">
                        <TableCell>Deduction (Schedule C Line 30)</TableCell>
                        <TableCell className="text-right font-mono text-green-700">
                          {formatCurrency(actualDeduction.deduction)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {simplifiedDeduction > 0 && actualDeduction.deduction > 0 && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <strong>Comparison:</strong>{' '}
                  {actualDeduction.deduction > simplifiedDeduction ? (
                    <>Actual method ({formatCurrency(actualDeduction.deduction)}) saves you{' '}
                    {formatCurrency(actualDeduction.deduction - simplifiedDeduction)} more than
                    simplified ({formatCurrency(simplifiedDeduction)})</>
                  ) : (
                    <>Simplified method ({formatCurrency(simplifiedDeduction)}) is better than
                    actual ({formatCurrency(actualDeduction.deduction)}) by{' '}
                    {formatCurrency(simplifiedDeduction - actualDeduction.deduction)}</>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Apply to Schedule C */}
          {currentDeduction > 0 && onDeductionChange && (
            <div className="mt-6 pt-6 border-t flex items-center justify-between">
              <div>
                <p className="font-medium">Apply to Schedule C</p>
                <p className="text-sm text-muted-foreground">
                  This will set Line 30 on your Schedule C report to {formatCurrency(currentDeduction)}
                </p>
              </div>
              <Button onClick={handleApplyDeduction}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Apply {formatCurrency(currentDeduction)}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
