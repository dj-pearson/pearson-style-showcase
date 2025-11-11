import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign,
  FileText,
  CreditCard,
  Upload,
  PieChart,
  BookOpen,
  Users,
  Receipt
} from 'lucide-react';
import { ChartOfAccountsManager } from './accounting/ChartOfAccountsManager';
import { InvoicesManager } from './accounting/InvoicesManager';
import { PaymentsManager } from './accounting/PaymentsManager';
import { ImportIntegrationsManager } from './accounting/ImportIntegrationsManager';
import { FinancialReports } from './accounting/FinancialReports';
import { ContactsManager } from './accounting/ContactsManager';
import { JournalEntriesManager } from './accounting/JournalEntriesManager';

export const AccountingDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Accounting</h2>
          <p className="text-muted-foreground">
            Manage your finances with integrated invoice import
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="overview">
            <DollarSign className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <FileText className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Invoices</span>
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Payments</span>
          </TabsTrigger>
          <TabsTrigger value="accounts">
            <BookOpen className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Accounts</span>
          </TabsTrigger>
          <TabsTrigger value="contacts">
            <Users className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Contacts</span>
          </TabsTrigger>
          <TabsTrigger value="journal">
            <Receipt className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Journal</span>
          </TabsTrigger>
          <TabsTrigger value="import">
            <Upload className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Import</span>
          </TabsTrigger>
          <TabsTrigger value="reports">
            <PieChart className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Reports</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0.00</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0.00</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0.00</div>
                <p className="text-xs text-muted-foreground">Unpaid invoices</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                <PieChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$0.00</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick Start</CardTitle>
              <CardDescription>
                Get started with your accounting module
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <button
                  onClick={() => setActiveTab('import')}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <Upload className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">Import Invoices</h4>
                    <p className="text-sm text-muted-foreground">
                      Connect Stripe, OpenAI, Claude, and other services
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('invoices')}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <FileText className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">Create Invoice</h4>
                    <p className="text-sm text-muted-foreground">
                      Manually create sales or purchase invoices
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('accounts')}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <BookOpen className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">Chart of Accounts</h4>
                    <p className="text-sm text-muted-foreground">
                      Review and customize your account structure
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('reports')}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <PieChart className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">Financial Reports</h4>
                    <p className="text-sm text-muted-foreground">
                      View P&L, Balance Sheet, and more
                    </p>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <InvoicesManager />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsManager />
        </TabsContent>

        <TabsContent value="accounts">
          <ChartOfAccountsManager />
        </TabsContent>

        <TabsContent value="contacts">
          <ContactsManager />
        </TabsContent>

        <TabsContent value="journal">
          <JournalEntriesManager />
        </TabsContent>

        <TabsContent value="import">
          <ImportIntegrationsManager />
        </TabsContent>

        <TabsContent value="reports">
          <FinancialReports />
        </TabsContent>
      </Tabs>
    </div>
  );
};
