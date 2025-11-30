import { describe, it, expect } from 'vitest';
import {
  calculateProfitLoss,
  calculateBalanceSheet,
  formatCurrency,
  validateJournalEntryBalance,
  calculateAccountBalance,
  calculateInvoiceAging,
  Invoice,
  PlatformTransaction,
  JournalEntry,
  Account,
} from '../calculations';

describe('Accounting Calculations', () => {
  describe('calculateProfitLoss', () => {
    it('should return zero values for empty inputs', () => {
      const result = calculateProfitLoss(null, null, null);

      expect(result.totalRevenue).toBe(0);
      expect(result.totalExpenses).toBe(0);
      expect(result.netProfit).toBe(0);
      expect(Object.keys(result.revenue)).toHaveLength(0);
      expect(Object.keys(result.expenses)).toHaveLength(0);
    });

    it('should calculate revenue from sales invoices', () => {
      const invoices: Invoice[] = [
        { invoice_type: 'sales', amount_paid: 1000 },
        { invoice_type: 'sales', amount_paid: 500 },
      ];

      const result = calculateProfitLoss(invoices, null, null);

      expect(result.totalRevenue).toBe(1500);
      expect(result.revenue['Sales Revenue']).toBe(1500);
    });

    it('should calculate expenses from purchase invoices', () => {
      const invoices: Invoice[] = [
        { invoice_type: 'purchase', amount_paid: 300 },
        { invoice_type: 'purchase', amount_paid: 200 },
      ];

      const result = calculateProfitLoss(invoices, null, null);

      expect(result.totalExpenses).toBe(500);
      expect(result.expenses['Vendor Expenses']).toBe(500);
    });

    it('should calculate revenue from platform transactions', () => {
      const transactions: PlatformTransaction[] = [
        { transaction_type: 'revenue', amount: 2000, platforms: { name: 'Amazon' } },
        { transaction_type: 'revenue', amount: 1500, platforms: { name: 'Etsy' } },
        { transaction_type: 'revenue', amount: 500, platforms: { name: 'Amazon' } },
      ];

      const result = calculateProfitLoss(null, transactions, null);

      expect(result.totalRevenue).toBe(4000);
      expect(result.revenue['Amazon']).toBe(2500);
      expect(result.revenue['Etsy']).toBe(1500);
    });

    it('should calculate expenses from platform transactions', () => {
      const transactions: PlatformTransaction[] = [
        { transaction_type: 'expense', amount: 100, expense_categories: { name: 'Advertising' } },
        { transaction_type: 'expense', amount: 50, expense_categories: { name: 'Shipping' } },
        { transaction_type: 'expense', amount: 75 }, // No category - should use "Operating Expenses"
      ];

      const result = calculateProfitLoss(null, transactions, null);

      expect(result.totalExpenses).toBe(225);
      expect(result.expenses['Advertising']).toBe(100);
      expect(result.expenses['Shipping']).toBe(50);
      expect(result.expenses['Operating Expenses']).toBe(75);
    });

    it('should calculate revenue/expenses from journal entries', () => {
      const journalEntries: JournalEntry[] = [
        {
          journal_entry_lines: [
            {
              account_id: '1',
              debit: 0,
              credit: 1000,
              accounts: { account_type: 'Income', account_name: 'Service Revenue' },
            },
            {
              account_id: '2',
              debit: 200,
              credit: 0,
              accounts: { account_type: 'Expense', account_name: 'Office Supplies' },
            },
          ],
        },
      ];

      const result = calculateProfitLoss(null, null, journalEntries);

      expect(result.revenue['Service Revenue']).toBe(1000);
      expect(result.expenses['Office Supplies']).toBe(200);
      expect(result.netProfit).toBe(800);
    });

    it('should calculate net profit correctly', () => {
      const invoices: Invoice[] = [
        { invoice_type: 'sales', amount_paid: 5000 },
        { invoice_type: 'purchase', amount_paid: 1500 },
      ];

      const transactions: PlatformTransaction[] = [
        { transaction_type: 'revenue', amount: 2000, platforms: { name: 'Amazon' } },
        { transaction_type: 'expense', amount: 500, expense_categories: { name: 'Fees' } },
      ];

      const result = calculateProfitLoss(invoices, transactions, null);

      expect(result.totalRevenue).toBe(7000); // 5000 + 2000
      expect(result.totalExpenses).toBe(2000); // 1500 + 500
      expect(result.netProfit).toBe(5000); // 7000 - 2000
    });

    it('should handle negative net profit (loss)', () => {
      const invoices: Invoice[] = [
        { invoice_type: 'sales', amount_paid: 1000 },
        { invoice_type: 'purchase', amount_paid: 3000 },
      ];

      const result = calculateProfitLoss(invoices, null, null);

      expect(result.netProfit).toBe(-2000);
    });

    it('should handle null/undefined amounts', () => {
      const invoices: Invoice[] = [
        { invoice_type: 'sales', amount_paid: null },
        { invoice_type: 'sales', amount_paid: undefined },
        { invoice_type: 'sales', amount_paid: 100 },
      ];

      const result = calculateProfitLoss(invoices, null, null);

      expect(result.totalRevenue).toBe(100);
    });
  });

  describe('calculateBalanceSheet', () => {
    it('should return zero values for empty inputs', () => {
      const result = calculateBalanceSheet(null, null, null, 0);

      expect(result.totalAssets).toBe(0);
      expect(result.totalLiabilities).toBe(0);
      expect(result.totalEquity).toBe(0);
      expect(result.isBalanced).toBe(true);
    });

    it('should calculate accounts receivable from unpaid sales invoices', () => {
      const invoices: Invoice[] = [
        { invoice_type: 'sales', amount_due: 500 },
        { invoice_type: 'sales', amount_due: 300 },
      ];

      const result = calculateBalanceSheet(invoices, null, null, 0);

      expect(result.assets['Accounts Receivable']).toBe(800);
    });

    it('should calculate accounts payable from unpaid purchase invoices', () => {
      const invoices: Invoice[] = [
        { invoice_type: 'purchase', amount_due: 400 },
        { invoice_type: 'purchase', amount_due: 100 },
      ];

      const result = calculateBalanceSheet(invoices, null, null, 0);

      expect(result.liabilities['Accounts Payable']).toBe(500);
    });

    it('should calculate account balances from journal entries', () => {
      const accounts: Account[] = [
        { id: 'cash', account_name: 'Cash', account_type: 'Asset', opening_balance: 1000 },
        { id: 'loan', account_name: 'Bank Loan', account_type: 'Liability', opening_balance: 500 },
      ];

      const journalEntries: JournalEntry[] = [
        {
          journal_entry_lines: [
            {
              account_id: 'cash',
              debit: 500,
              credit: 0,
              accounts: { account_type: 'Asset', account_name: 'Cash' },
            },
            {
              account_id: 'loan',
              debit: 0,
              credit: 500,
              accounts: { account_type: 'Liability', account_name: 'Bank Loan' },
            },
          ],
        },
      ];

      const result = calculateBalanceSheet(null, journalEntries, accounts, 0);

      // Cash: 1000 opening + 500 debit = 1500
      expect(result.assets['Cash']).toBe(1500);
      // Bank Loan: 500 opening + 500 credit = 1000
      expect(result.liabilities['Bank Loan']).toBe(1000);
    });

    it('should include retained earnings from net profit', () => {
      const result = calculateBalanceSheet(null, null, null, 5000);

      expect(result.equity['Retained Earnings']).toBe(5000);
      expect(result.totalEquity).toBe(5000);
    });

    it('should detect balanced balance sheet', () => {
      const accounts: Account[] = [
        { id: 'cash', account_name: 'Cash', account_type: 'Asset', opening_balance: 10000 },
        { id: 'equity', account_name: 'Owner Equity', account_type: 'Equity', opening_balance: 10000 },
      ];

      const result = calculateBalanceSheet(null, null, accounts, 0);

      expect(result.totalAssets).toBe(10000);
      expect(result.totalEquity).toBe(10000);
      expect(result.isBalanced).toBe(true);
    });

    it('should detect unbalanced balance sheet', () => {
      const accounts: Account[] = [
        { id: 'cash', account_name: 'Cash', account_type: 'Asset', opening_balance: 10000 },
        { id: 'equity', account_name: 'Owner Equity', account_type: 'Equity', opening_balance: 5000 },
      ];

      const result = calculateBalanceSheet(null, null, accounts, 0);

      expect(result.isBalanced).toBe(false);
    });

    it('should handle accounts with zero balance (exclude from report)', () => {
      const accounts: Account[] = [
        { id: 'cash', account_name: 'Cash', account_type: 'Asset', opening_balance: 0 },
        { id: 'bank', account_name: 'Bank', account_type: 'Asset', opening_balance: 1000 },
      ];

      const result = calculateBalanceSheet(null, null, accounts, 0);

      expect(result.assets['Cash']).toBeUndefined();
      expect(result.assets['Bank']).toBe(1000);
    });
  });

  describe('formatCurrency', () => {
    it('should format positive amounts correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(1000)).toBe('$1,000.00');
    });

    it('should format negative amounts correctly', () => {
      expect(formatCurrency(-500)).toBe('-$500.00');
    });

    it('should format zero correctly', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should handle large amounts', () => {
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
    });
  });

  describe('validateJournalEntryBalance', () => {
    it('should validate balanced entry', () => {
      const lines = [
        { debit: 1000, credit: 0 },
        { debit: 0, credit: 1000 },
      ];

      const result = validateJournalEntryBalance(lines);

      expect(result.isBalanced).toBe(true);
      expect(result.totalDebits).toBe(1000);
      expect(result.totalCredits).toBe(1000);
      expect(result.difference).toBe(0);
    });

    it('should detect unbalanced entry', () => {
      const lines = [
        { debit: 1000, credit: 0 },
        { debit: 0, credit: 500 },
      ];

      const result = validateJournalEntryBalance(lines);

      expect(result.isBalanced).toBe(false);
      expect(result.difference).toBe(500);
    });

    it('should handle multiple line entries', () => {
      const lines = [
        { debit: 500, credit: 0 },
        { debit: 300, credit: 0 },
        { debit: 200, credit: 0 },
        { debit: 0, credit: 1000 },
      ];

      const result = validateJournalEntryBalance(lines);

      expect(result.isBalanced).toBe(true);
      expect(result.totalDebits).toBe(1000);
      expect(result.totalCredits).toBe(1000);
    });

    it('should handle floating point precision', () => {
      const lines = [
        { debit: 33.33, credit: 0 },
        { debit: 33.33, credit: 0 },
        { debit: 33.34, credit: 0 },
        { debit: 0, credit: 100 },
      ];

      const result = validateJournalEntryBalance(lines);

      expect(result.isBalanced).toBe(true);
    });
  });

  describe('calculateAccountBalance', () => {
    it('should calculate Asset account balance (debits increase)', () => {
      const transactions = [
        { debit: 1000, credit: 0 },
        { debit: 0, credit: 200 },
        { debit: 500, credit: 0 },
      ];

      const result = calculateAccountBalance('Asset', 0, transactions);

      expect(result).toBe(1300); // 1000 - 200 + 500
    });

    it('should calculate Liability account balance (credits increase)', () => {
      const transactions = [
        { debit: 0, credit: 5000 },
        { debit: 1000, credit: 0 },
      ];

      const result = calculateAccountBalance('Liability', 0, transactions);

      expect(result).toBe(4000); // 5000 - 1000
    });

    it('should include opening balance', () => {
      const transactions = [
        { debit: 500, credit: 0 },
      ];

      const result = calculateAccountBalance('Asset', 1000, transactions);

      expect(result).toBe(1500);
    });

    it('should handle Income accounts (credits increase)', () => {
      const transactions = [
        { debit: 0, credit: 2000 },
        { debit: 100, credit: 0 }, // refund
      ];

      const result = calculateAccountBalance('Income', 0, transactions);

      expect(result).toBe(1900);
    });

    it('should handle Expense accounts (debits increase)', () => {
      const transactions = [
        { debit: 500, credit: 0 },
        { debit: 300, credit: 0 },
      ];

      const result = calculateAccountBalance('Expense', 0, transactions);

      expect(result).toBe(800);
    });
  });

  describe('calculateInvoiceAging', () => {
    it('should categorize current invoices (not yet due)', () => {
      const today = new Date('2024-01-15');
      const invoices = [
        { amount_due: 1000, due_date: '2024-01-20' },
        { amount_due: 500, due_date: '2024-01-30' },
      ];

      const result = calculateInvoiceAging(invoices, today);

      expect(result.current).toBe(1500);
      expect(result.days30).toBe(0);
      expect(result.total).toBe(1500);
    });

    it('should categorize 1-30 days overdue', () => {
      const today = new Date('2024-01-31');
      const invoices = [
        { amount_due: 1000, due_date: '2024-01-15' }, // 16 days overdue
        { amount_due: 500, due_date: '2024-01-01' }, // 30 days overdue
      ];

      const result = calculateInvoiceAging(invoices, today);

      expect(result.days30).toBe(1500);
    });

    it('should categorize 31-60 days overdue', () => {
      const today = new Date('2024-03-01');
      const invoices = [
        { amount_due: 2000, due_date: '2024-01-15' }, // 46 days overdue
      ];

      const result = calculateInvoiceAging(invoices, today);

      expect(result.days60).toBe(2000);
    });

    it('should categorize 90+ days overdue', () => {
      const today = new Date('2024-06-01');
      const invoices = [
        { amount_due: 3000, due_date: '2024-01-01' }, // ~150 days overdue
      ];

      const result = calculateInvoiceAging(invoices, today);

      expect(result.days90Plus).toBe(3000);
    });

    it('should calculate total correctly across all buckets', () => {
      const today = new Date('2024-03-15');
      const invoices = [
        { amount_due: 1000, due_date: '2024-03-20' }, // current
        { amount_due: 500, due_date: '2024-03-01' }, // 14 days - 30 bucket
        { amount_due: 750, due_date: '2024-02-01' }, // 43 days - 60 bucket
        { amount_due: 250, due_date: '2023-12-01' }, // 105 days - 90+ bucket
      ];

      const result = calculateInvoiceAging(invoices, today);

      expect(result.current).toBe(1000);
      expect(result.days30).toBe(500);
      expect(result.days60).toBe(750);
      expect(result.days90Plus).toBe(250);
      expect(result.total).toBe(2500);
    });
  });
});

describe('Double-Entry Accounting Rules', () => {
  it('should follow the accounting equation: Assets = Liabilities + Equity', () => {
    const accounts: Account[] = [
      { id: 'cash', account_name: 'Cash', account_type: 'Asset', opening_balance: 50000 },
      { id: 'equip', account_name: 'Equipment', account_type: 'Asset', opening_balance: 30000 },
      { id: 'loan', account_name: 'Bank Loan', account_type: 'Liability', opening_balance: 20000 },
      { id: 'equity', account_name: 'Owner Equity', account_type: 'Equity', opening_balance: 60000 },
    ];

    const result = calculateBalanceSheet(null, null, accounts, 0);

    expect(result.totalAssets).toBe(80000); // 50000 + 30000
    expect(result.totalLiabilities + result.totalEquity).toBe(80000); // 20000 + 60000
    expect(result.isBalanced).toBe(true);
  });

  it('should correctly handle a complex transaction flow', () => {
    // Scenario: Sell services for $5000, receive $3000 now, $2000 on credit
    // Then pay $1000 in expenses

    const invoices: Invoice[] = [
      { invoice_type: 'sales', amount_paid: 3000, amount_due: 2000 },
      { invoice_type: 'purchase', amount_paid: 1000, amount_due: 0 },
    ];

    const accounts: Account[] = [
      { id: 'cash', account_name: 'Cash', account_type: 'Asset', opening_balance: 10000 },
    ];

    const journalEntries: JournalEntry[] = [
      {
        // Cash received: +3000
        // Accounts Receivable: +2000
        journal_entry_lines: [
          { account_id: 'cash', debit: 3000, credit: 0, accounts: { account_type: 'Asset', account_name: 'Cash' } },
        ],
      },
      {
        // Cash paid for expenses: -1000
        journal_entry_lines: [
          { account_id: 'cash', debit: 0, credit: 1000, accounts: { account_type: 'Asset', account_name: 'Cash' } },
        ],
      },
    ];

    // P&L: Revenue $3000, Expenses $1000, Net Profit $2000
    const profitLoss = calculateProfitLoss(invoices, null, null);
    expect(profitLoss.netProfit).toBe(2000);

    // Balance Sheet
    const balanceSheet = calculateBalanceSheet(invoices, journalEntries, accounts, profitLoss.netProfit);

    // Cash: 10000 + 3000 - 1000 = 12000
    expect(balanceSheet.assets['Cash']).toBe(12000);
    // Accounts Receivable: 2000
    expect(balanceSheet.assets['Accounts Receivable']).toBe(2000);
    // Total Assets: 14000
    expect(balanceSheet.totalAssets).toBe(14000);
    // Retained Earnings should equal Net Profit
    expect(balanceSheet.equity['Retained Earnings']).toBe(2000);
  });
});
