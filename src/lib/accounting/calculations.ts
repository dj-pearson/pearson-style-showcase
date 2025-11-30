/**
 * Accounting Calculation Utilities
 *
 * Pure functions for financial calculations that can be unit tested
 * independently of React components and database queries.
 */

export interface Invoice {
  id?: string;
  invoice_type: 'sales' | 'purchase';
  amount_paid?: number | null;
  amount_due?: number | null;
}

export interface PlatformTransaction {
  id?: string;
  transaction_type: 'revenue' | 'expense';
  amount?: number | null;
  platforms?: { name: string; platform_type?: string } | null;
  expense_categories?: { name: string; category_code?: string } | null;
}

export interface JournalEntryLine {
  id?: string;
  account_id?: string;
  debit?: number | null;
  credit?: number | null;
  accounts?: {
    id?: string;
    account_number?: string;
    account_name?: string;
    account_type?: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
    account_subtype?: string;
  } | null;
}

export interface JournalEntry {
  id?: string;
  status?: string;
  entry_date?: string;
  journal_entry_lines?: JournalEntryLine[];
}

export interface Account {
  id: string;
  account_name: string;
  account_type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
  opening_balance?: number | null;
}

export interface ProfitLossData {
  revenue: Record<string, number>;
  expenses: Record<string, number>;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

export interface BalanceSheetData {
  assets: Record<string, number>;
  liabilities: Record<string, number>;
  equity: Record<string, number>;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
}

/**
 * Calculate Profit & Loss data from invoices, transactions, and journal entries
 */
export function calculateProfitLoss(
  invoices: Invoice[] | null | undefined,
  platformTransactions: PlatformTransaction[] | null | undefined,
  journalEntries: JournalEntry[] | null | undefined
): ProfitLossData {
  const revenue: Record<string, number> = {};
  const expenses: Record<string, number> = {};

  // Revenue from sales invoices
  invoices?.forEach((invoice) => {
    if (invoice.invoice_type === 'sales') {
      const amount = Number(invoice.amount_paid || 0);
      revenue['Sales Revenue'] = (revenue['Sales Revenue'] || 0) + amount;
    }
  });

  // Revenue from platform transactions
  platformTransactions?.forEach((transaction) => {
    if (transaction.transaction_type === 'revenue') {
      const amount = Number(transaction.amount || 0);
      const platformName = transaction.platforms?.name || 'Other Revenue';
      revenue[platformName] = (revenue[platformName] || 0) + amount;
    }
  });

  // Expenses from purchase invoices
  invoices?.forEach((invoice) => {
    if (invoice.invoice_type === 'purchase') {
      const amount = Number(invoice.amount_paid || 0);
      expenses['Vendor Expenses'] = (expenses['Vendor Expenses'] || 0) + amount;
    }
  });

  // Expenses from platform transactions
  platformTransactions?.forEach((transaction) => {
    if (transaction.transaction_type === 'expense') {
      const amount = Number(transaction.amount || 0);
      const categoryName = transaction.expense_categories?.name || 'Operating Expenses';
      expenses[categoryName] = (expenses[categoryName] || 0) + amount;
    }
  });

  // Add journal entry amounts (Income and Expense accounts only)
  journalEntries?.forEach((entry) => {
    entry.journal_entry_lines?.forEach((line) => {
      const accountType = line.accounts?.account_type;
      const accountName = line.accounts?.account_name || 'Other';
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);

      if (accountType === 'Income') {
        // Credits increase income
        const amount = credit - debit;
        revenue[accountName] = (revenue[accountName] || 0) + amount;
      } else if (accountType === 'Expense') {
        // Debits increase expenses
        const amount = debit - credit;
        expenses[accountName] = (expenses[accountName] || 0) + amount;
      }
    });
  });

  const totalRevenue = Object.values(revenue).reduce((sum, val) => sum + val, 0);
  const totalExpenses = Object.values(expenses).reduce((sum, val) => sum + val, 0);
  const netProfit = totalRevenue - totalExpenses;

  return {
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netProfit,
  };
}

/**
 * Calculate Balance Sheet data from invoices, journal entries, and accounts
 */
export function calculateBalanceSheet(
  invoices: Invoice[] | null | undefined,
  journalEntries: JournalEntry[] | null | undefined,
  accounts: Account[] | null | undefined,
  netProfit: number
): BalanceSheetData {
  const assets: Record<string, number> = {};
  const liabilities: Record<string, number> = {};
  const equity: Record<string, number> = {};

  // Calculate accounts receivable (unpaid sales invoices)
  let accountsReceivable = 0;
  invoices?.forEach((invoice) => {
    if (invoice.invoice_type === 'sales') {
      accountsReceivable += Number(invoice.amount_due || 0);
    }
  });
  if (accountsReceivable > 0) {
    assets['Accounts Receivable'] = accountsReceivable;
  }

  // Calculate accounts payable (unpaid purchase invoices)
  let accountsPayable = 0;
  invoices?.forEach((invoice) => {
    if (invoice.invoice_type === 'purchase') {
      accountsPayable += Number(invoice.amount_due || 0);
    }
  });
  if (accountsPayable > 0) {
    liabilities['Accounts Payable'] = accountsPayable;
  }

  // Add balances from accounts via journal entries
  const accountBalances: Record<string, number> = {};

  journalEntries?.forEach((entry) => {
    entry.journal_entry_lines?.forEach((line) => {
      const accountId = line.account_id;
      if (!accountId) return;

      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);

      if (!accountBalances[accountId]) {
        accountBalances[accountId] = 0;
      }

      // For Asset and Expense accounts, debits increase, credits decrease
      // For Liability, Equity, and Income accounts, credits increase, debits decrease
      const accountType = line.accounts?.account_type;
      if (accountType === 'Asset' || accountType === 'Expense') {
        accountBalances[accountId] += (debit - credit);
      } else {
        accountBalances[accountId] += (credit - debit);
      }
    });
  });

  // Add account balances to appropriate categories
  accounts?.forEach((account) => {
    const balance = accountBalances[account.id] || 0;

    // Also add opening balance
    const totalBalance = balance + Number(account.opening_balance || 0);

    if (totalBalance === 0) return;

    const accountName = account.account_name;

    if (account.account_type === 'Asset') {
      assets[accountName] = totalBalance;
    } else if (account.account_type === 'Liability') {
      liabilities[accountName] = totalBalance;
    } else if (account.account_type === 'Equity') {
      equity[accountName] = totalBalance;
    }
  });

  // Calculate retained earnings from P&L
  if (netProfit !== 0) {
    equity['Retained Earnings'] = (equity['Retained Earnings'] || 0) + netProfit;
  }

  const totalAssets = Object.values(assets).reduce((sum, val) => sum + val, 0);
  const totalLiabilities = Object.values(liabilities).reduce((sum, val) => sum + val, 0);
  const totalEquity = Object.values(equity).reduce((sum, val) => sum + val, 0);

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  };
}

/**
 * Format a number as USD currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Validate that a journal entry is balanced (debits = credits)
 */
export function validateJournalEntryBalance(lines: JournalEntryLine[]): {
  isBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number;
} {
  const totalDebits = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const totalCredits = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  const difference = Math.abs(totalDebits - totalCredits);

  return {
    isBalanced: difference < 0.01, // Allow for floating point precision
    totalDebits,
    totalCredits,
    difference,
  };
}

/**
 * Calculate the running balance for an account based on transactions
 */
export function calculateAccountBalance(
  accountType: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense',
  openingBalance: number,
  transactions: Array<{ debit: number; credit: number }>
): number {
  let balance = openingBalance;

  transactions.forEach(({ debit, credit }) => {
    if (accountType === 'Asset' || accountType === 'Expense') {
      // Debits increase, credits decrease
      balance += debit - credit;
    } else {
      // Credits increase, debits decrease
      balance += credit - debit;
    }
  });

  return balance;
}

/**
 * Calculate invoice aging buckets (current, 30, 60, 90+ days)
 */
export function calculateInvoiceAging(
  invoices: Array<{ amount_due: number; due_date: string }>,
  asOfDate: Date = new Date()
): {
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
  total: number;
} {
  const result = {
    current: 0,
    days30: 0,
    days60: 0,
    days90Plus: 0,
    total: 0,
  };

  const now = asOfDate.getTime();

  invoices.forEach(({ amount_due, due_date }) => {
    const dueTime = new Date(due_date).getTime();
    const daysOverdue = Math.floor((now - dueTime) / (1000 * 60 * 60 * 24));
    const amount = Number(amount_due || 0);

    result.total += amount;

    if (daysOverdue <= 0) {
      result.current += amount;
    } else if (daysOverdue <= 30) {
      result.days30 += amount;
    } else if (daysOverdue <= 60) {
      result.days60 += amount;
    } else {
      result.days90Plus += amount;
    }
  });

  return result;
}
