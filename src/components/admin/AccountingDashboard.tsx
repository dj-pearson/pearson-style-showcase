import { useState } from 'react';
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
  Receipt,
  Repeat,
  Tag,
  TrendingUp
} from 'lucide-react';
import { ChartOfAccountsManager } from './accounting/ChartOfAccountsManager';
import { InvoicesManager } from './accounting/InvoicesManager';
import { PaymentsManager } from './accounting/PaymentsManager';
import { ImportIntegrationsManager } from './accounting/ImportIntegrationsManager';
import { FinancialReports } from './accounting/FinancialReports';
import { ContactsManager } from './accounting/ContactsManager';
import { JournalEntriesManager } from './accounting/JournalEntriesManager';
import PlatformsManager from './accounting/PlatformsManager';
import RecurringTransactionsManager from './accounting/RecurringTransactionsManager';
import ExpenseCategoriesManager from './accounting/ExpenseCategoriesManager';
import FinancialOverview from './accounting/FinancialOverview';

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
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="platforms" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Platforms</span>
            </TabsTrigger>
            <TabsTrigger value="recurring" className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              <span className="hidden sm:inline">Recurring</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Invoices</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Payments</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Accounts</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Contacts</span>
            </TabsTrigger>
            <TabsTrigger value="journal" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Journal</span>
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">Reports</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <FinancialOverview onNavigate={setActiveTab} />

          <Card>
            <CardHeader>
              <CardTitle>Quick Start</CardTitle>
              <CardDescription>
                Get started with your accounting module
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <button
                  onClick={() => setActiveTab('platforms')}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">Manage Platforms</h4>
                    <p className="text-sm text-muted-foreground">
                      Track 10+ revenue and expense platforms
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('recurring')}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <Repeat className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">Recurring Transactions</h4>
                    <p className="text-sm text-muted-foreground">
                      Automate monthly expenses and subscriptions
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('categories')}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <Tag className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">Expense Categories</h4>
                    <p className="text-sm text-muted-foreground">
                      Tax-ready categorization for IRS reporting
                    </p>
                  </div>
                </button>
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
                  onClick={() => setActiveTab('reports')}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <PieChart className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">Financial Reports</h4>
                    <p className="text-sm text-muted-foreground">
                      View P&L, Balance Sheet, and tax reports
                    </p>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platforms">
          <PlatformsManager />
        </TabsContent>

        <TabsContent value="recurring">
          <RecurringTransactionsManager />
        </TabsContent>

        <TabsContent value="categories">
          <ExpenseCategoriesManager />
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
