import React, { useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PieChart,
  BarChart3,
  TrendingUp,
  FileText,
  Download,
  Calendar,
} from 'lucide-react';

export const FinancialReports = () => {
  const [dateRange, setDateRange] = useState('this-month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Financial Reports</CardTitle>
              <CardDescription>
                View Profit & Loss, Balance Sheet, and other financial reports
              </CardDescription>
            </div>
            <Button>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="this-quarter">This Quarter</SelectItem>
                  <SelectItem value="last-quarter">Last Quarter</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                  <SelectItem value="last-year">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dateRange === 'custom' && (
              <>
                <div className="flex-1">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <Tabs defaultValue="profit-loss" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profit-loss">
                <TrendingUp className="h-4 w-4 mr-2" />
                P&L
              </TabsTrigger>
              <TabsTrigger value="balance-sheet">
                <BarChart3 className="h-4 w-4 mr-2" />
                Balance Sheet
              </TabsTrigger>
              <TabsTrigger value="general-ledger">
                <FileText className="h-4 w-4 mr-2" />
                General Ledger
              </TabsTrigger>
              <TabsTrigger value="trial-balance">
                <PieChart className="h-4 w-4 mr-2" />
                Trial Balance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profit-loss">
              <Card>
                <CardHeader>
                  <CardTitle>Profit & Loss Statement</CardTitle>
                  <CardDescription>
                    Revenue, expenses, and net income for the selected period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Revenue</h3>
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell>Sales Revenue</TableCell>
                            <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Service Revenue</TableCell>
                            <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                          </TableRow>
                          <TableRow className="font-medium bg-muted/50">
                            <TableCell>Total Revenue</TableCell>
                            <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-2">Expenses</h3>
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell>Software Subscriptions</TableCell>
                            <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>API & Cloud Services</TableCell>
                            <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Marketing & Advertising</TableCell>
                            <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                          </TableRow>
                          <TableRow className="font-medium bg-muted/50">
                            <TableCell>Total Expenses</TableCell>
                            <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    <div className="pt-4 border-t-2">
                      <Table>
                        <TableBody>
                          <TableRow className="font-bold text-lg">
                            <TableCell>Net Profit</TableCell>
                            <TableCell className="text-right text-green-600">
                              {formatCurrency(0)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="balance-sheet">
              <Card>
                <CardHeader>
                  <CardTitle>Balance Sheet</CardTitle>
                  <CardDescription>
                    Assets, liabilities, and equity as of selected date
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Assets</h3>
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell>Cash</TableCell>
                            <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Accounts Receivable</TableCell>
                            <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                          </TableRow>
                          <TableRow className="font-medium bg-muted/50">
                            <TableCell>Total Assets</TableCell>
                            <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-2">Liabilities</h3>
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell>Accounts Payable</TableCell>
                            <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                          </TableRow>
                          <TableRow className="font-medium bg-muted/50">
                            <TableCell>Total Liabilities</TableCell>
                            <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-2">Equity</h3>
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell>Owner Equity</TableCell>
                            <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Retained Earnings</TableCell>
                            <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                          </TableRow>
                          <TableRow className="font-medium bg-muted/50">
                            <TableCell>Total Equity</TableCell>
                            <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    <div className="pt-4 border-t-2">
                      <Table>
                        <TableBody>
                          <TableRow className="font-bold text-lg">
                            <TableCell>Total Liabilities & Equity</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(0)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="general-ledger">
              <Card>
                <CardHeader>
                  <CardTitle>General Ledger</CardTitle>
                  <CardDescription>
                    All transactions for the selected period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No transactions yet</p>
                    <p className="text-sm">
                      Transactions will appear here once you create invoices or journal entries
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trial-balance">
              <Card>
                <CardHeader>
                  <CardTitle>Trial Balance</CardTitle>
                  <CardDescription>
                    Verify that debits equal credits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="font-bold bg-muted">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <div className="mt-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Trial balance is in balance ✓
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
