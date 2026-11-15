import { lazy, Suspense, useCallback, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  TrendingUp,
  Zap,
  Download,
} from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';

// Each tab's module loads the first time the tab opens, so the accounting
// view no longer pulls every manager into one chunk.
const FinancialOverview = lazy(() => import('./accounting/FinancialOverview'));
const AIBillingTracker = lazy(() =>
  import('./accounting/AIBillingTracker').then((m) => ({ default: m.AIBillingTracker }))
);
const PlatformsManager = lazy(() => import('./accounting/PlatformsManager'));
const InvoicesManager = lazy(() =>
  import('./accounting/InvoicesManager').then((m) => ({ default: m.InvoicesManager }))
);
const PaymentsManager = lazy(() =>
  import('./accounting/PaymentsManager').then((m) => ({ default: m.PaymentsManager }))
);
const RecurringTransactionsManager = lazy(
  () => import('./accounting/RecurringTransactionsManager')
);
const ExpenseCategoriesManager = lazy(() => import('./accounting/ExpenseCategoriesManager'));
const ChartOfAccountsManager = lazy(() =>
  import('./accounting/ChartOfAccountsManager').then((m) => ({
    default: m.ChartOfAccountsManager,
  }))
);
const ContactsManager = lazy(() =>
  import('./accounting/ContactsManager').then((m) => ({ default: m.ContactsManager }))
);
const JournalEntriesManager = lazy(() =>
  import('./accounting/JournalEntriesManager').then((m) => ({
    default: m.JournalEntriesManager,
  }))
);
const ImportIntegrationsManager = lazy(() =>
  import('./accounting/ImportIntegrationsManager').then((m) => ({
    default: m.ImportIntegrationsManager,
  }))
);
const DataExporter = lazy(() =>
  import('./accounting/DataExporter').then((m) => ({ default: m.DataExporter }))
);
const FinancialReports = lazy(() =>
  import('./accounting/FinancialReports').then((m) => ({ default: m.FinancialReports }))
);
const TaxCenter = lazy(() =>
  import('./accounting/TaxCenter').then((m) => ({ default: m.TaxCenter }))
);

const TABS = [
  'overview',
  'ai-billing',
  'platforms',
  'invoices',
  'payments',
  'recurring',
  'categories',
  'accounts',
  'contacts',
  'journal',
  'import',
  'export',
  'reports',
  'tax',
] as const;
type AccountingTab = (typeof TABS)[number];

/** Query param holding the open tab. AdminDashboard owns `view`. */
const TAB_PARAM = 'tab';

function isAccountingTab(value: string | null): value is AccountingTab {
  return !!value && (TABS as readonly string[]).includes(value);
}

const TabFallback = () => <TableSkeleton rows={6} columns={4} />;

const Lazy = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<TabFallback />}>{children}</Suspense>
);

export const AccountingDashboard = () => {
  // The open tab lives in the URL (?tab=invoices) so a refresh keeps it and
  // Back returns to the previous tab. Other params (view, ...) are kept.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get(TAB_PARAM);
  const activeTab: AccountingTab = isAccountingTab(tabParam) ? tabParam : 'overview';

  const setActiveTab = useCallback(
    (tab: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (tab === 'overview' || !isAccountingTab(tab)) next.delete(TAB_PARAM);
        else next.set(TAB_PARAM, tab);
        return next;
      });
    },
    [setSearchParams]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Accounting</h2>
          <p className="text-muted-foreground">
            Track expenses, AI billing, invoices, and export financial data
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
            <TabsTrigger value="ai-billing" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">AI Billing</span>
            </TabsTrigger>
            <TabsTrigger value="platforms" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Platforms</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Invoices</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Payments</span>
            </TabsTrigger>
            <TabsTrigger value="recurring" className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              <span className="hidden sm:inline">Recurring</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
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
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">Reports</span>
            </TabsTrigger>
            <TabsTrigger value="tax" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Tax</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <Lazy>
            <FinancialOverview onNavigate={setActiveTab} />
          </Lazy>

          <Card>
            <CardHeader>
              <CardTitle>Quick Start</CardTitle>
              <CardDescription>Get started with your accounting module</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <button
                  onClick={() => setActiveTab('ai-billing')}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <Zap className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">AI Billing & Usage</h4>
                    <p className="text-sm text-muted-foreground">
                      Track OpenAI, Anthropic, and all AI service costs
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('import')}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <Upload className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">Upload Invoices</h4>
                    <p className="text-sm text-muted-foreground">
                      Upload PDFs - AI extracts data to the right fields
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('platforms')}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">Manage Platforms</h4>
                    <p className="text-sm text-muted-foreground">
                      Track revenue and expense platforms
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
                      Automate monthly subscriptions and expenses
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('export')}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <Download className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">Export Data</h4>
                    <p className="text-sm text-muted-foreground">
                      Export all financial data to CSV with field mapping
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

        <TabsContent value="ai-billing">
          <Lazy>
            <AIBillingTracker />
          </Lazy>
        </TabsContent>

        <TabsContent value="platforms">
          <Lazy>
            <PlatformsManager />
          </Lazy>
        </TabsContent>

        <TabsContent value="invoices">
          <Lazy>
            <InvoicesManager />
          </Lazy>
        </TabsContent>

        <TabsContent value="payments">
          <Lazy>
            <PaymentsManager />
          </Lazy>
        </TabsContent>

        <TabsContent value="recurring">
          <Lazy>
            <RecurringTransactionsManager />
          </Lazy>
        </TabsContent>

        <TabsContent value="categories">
          <Lazy>
            <ExpenseCategoriesManager />
          </Lazy>
        </TabsContent>

        <TabsContent value="accounts">
          <Lazy>
            <ChartOfAccountsManager />
          </Lazy>
        </TabsContent>

        <TabsContent value="contacts">
          <Lazy>
            <ContactsManager />
          </Lazy>
        </TabsContent>

        <TabsContent value="journal">
          <Lazy>
            <JournalEntriesManager />
          </Lazy>
        </TabsContent>

        <TabsContent value="import">
          <Lazy>
            <ImportIntegrationsManager />
          </Lazy>
        </TabsContent>

        <TabsContent value="export">
          <Lazy>
            <DataExporter />
          </Lazy>
        </TabsContent>

        <TabsContent value="reports">
          <Lazy>
            <FinancialReports />
          </Lazy>
        </TabsContent>

        <TabsContent value="tax">
          <Lazy>
            <TaxCenter />
          </Lazy>
        </TabsContent>
      </Tabs>
    </div>
  );
};
