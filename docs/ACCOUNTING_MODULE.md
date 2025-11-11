# Accounting Module Documentation

## Overview

The Accounting Module is a comprehensive financial management system integrated into the admin area. It provides double-entry bookkeeping, invoice management, payment tracking, and automated invoice imports from popular services like Stripe, OpenAI, Anthropic (Claude), Lovable, and Replit.

This module is inspired by [Frappe Books](https://github.com/frappe/books) but built natively for this Supabase/React stack.

## Features

### Core Accounting Features

- **Double-Entry Bookkeeping**: Complete chart of accounts with assets, liabilities, equity, income, and expenses
- **Invoice Management**: Create and manage both sales invoices and purchase bills
- **Payment Tracking**: Record payments received and made, with automatic invoice allocation
- **Contacts Management**: Maintain customer and vendor information
- **Journal Entries**: Manual bookkeeping entries for adjustments and corrections
- **Multi-Currency Support**: Handle transactions in multiple currencies (USD, EUR, GBP, etc.)

### Invoice Import Integrations

Automatically import invoices from:

- **Stripe**: Import customer invoices, subscriptions, and payment data
- **OpenAI**: Import API usage invoices (manual export required)
- **Anthropic (Claude)**: Import API usage invoices (manual export required)
- **Lovable**: Manual CSV import support
- **Replit**: Manual CSV import support
- **Generic CSV**: Import from any service using CSV format

### Financial Reports

- **Profit & Loss Statement**: Revenue, expenses, and net income
- **Balance Sheet**: Assets, liabilities, and equity
- **General Ledger**: Complete transaction history
- **Trial Balance**: Verify accounting accuracy (debits = credits)

## Database Schema

### Core Tables

#### `currencies`
Supported currencies with exchange rates
- `code`: Currency code (USD, EUR, etc.)
- `name`: Full currency name
- `symbol`: Currency symbol ($, €, etc.)
- `exchange_rate`: Rate relative to base currency
- `is_base`: Whether this is the base currency

#### `accounts`
Chart of accounts for double-entry bookkeeping
- `account_number`: Account number (e.g., "1100")
- `account_name`: Display name (e.g., "Cash")
- `account_type`: Asset, Liability, Equity, Income, or Expense
- `parent_account_id`: For hierarchical accounts
- `current_balance`: Current account balance

#### `invoices`
Sales invoices and purchase bills
- `invoice_type`: 'sales' or 'purchase'
- `invoice_number`: Unique invoice identifier
- `invoice_date`: Invoice date
- `due_date`: Payment due date
- `total_amount`: Total invoice amount
- `amount_paid`: Amount already paid
- `amount_due`: Outstanding amount
- `status`: draft, sent, paid, partially_paid, overdue, cancelled, void
- `import_source`: Source of import (stripe, openai, manual, etc.)
- `external_id`: ID from external system
- `external_url`: Link to view in external system

#### `invoice_items`
Line items for invoices
- `invoice_id`: Reference to invoice
- `description`: Item description
- `quantity`: Quantity
- `unit_price`: Price per unit
- `tax_amount`: Tax amount
- `line_total`: Total for this line

#### `payments`
Payment records
- `payment_type`: 'received' or 'made'
- `payment_number`: Unique payment identifier
- `payment_date`: Date of payment
- `amount`: Payment amount
- `payment_method`: bank_transfer, credit_card, cash, etc.

#### `payment_allocations`
Links payments to invoices
- `payment_id`: Reference to payment
- `invoice_id`: Reference to invoice
- `amount_allocated`: Amount allocated to this invoice

#### `journal_entries`
Manual journal entries
- `entry_number`: Unique entry identifier
- `entry_date`: Entry date
- `status`: draft, posted, void

#### `journal_entry_lines`
Debit/credit lines for journal entries
- `journal_entry_id`: Reference to journal entry
- `account_id`: Reference to account
- `debit`: Debit amount
- `credit`: Credit amount

#### `import_sources`
Configuration for import integrations
- `source_name`: stripe, openai, anthropic, etc.
- `api_key`: API credentials (encrypted)
- `configuration`: Additional settings
- `last_import_at`: Last successful import timestamp

#### `import_logs`
Track all import operations
- `import_source_id`: Reference to import source
- `status`: pending, processing, completed, failed
- `records_total`: Total records to import
- `records_imported`: Successfully imported
- `records_failed`: Failed imports

## Usage Guide

### Accessing the Accounting Module

1. Log in to the Admin Dashboard
2. Click "Accounting" in the sidebar menu
3. Navigate through the tabs: Overview, Invoices, Payments, Accounts, Contacts, Journal, Import, Reports

### Setting Up Import Integrations

#### Stripe Integration

1. Go to **Accounting → Import** tab
2. Click **Configure** on the Stripe card
3. Enter your Stripe API key:
   - Get it from: Stripe Dashboard → Developers → API Keys
   - Use **Restricted Keys** for security
   - Required permissions: `read-only` access to invoices and charges
4. Click **Save Configuration**
5. Click **Import Now** to start importing invoices

#### OpenAI Integration

Since OpenAI doesn't provide a direct billing API:

1. Visit [OpenAI Platform](https://platform.openai.com/account/billing/history)
2. Export your usage data as CSV
3. Go to **Accounting → Import** tab
4. Upload the CSV file (format: Invoice Number, Date, Amount, Description)

#### Anthropic (Claude) Integration

Since Anthropic doesn't provide a public billing API yet:

1. Visit [Anthropic Console](https://console.anthropic.com/settings/billing)
2. Export your usage/billing data
3. Go to **Accounting → Import** tab
4. Upload the data as CSV

#### Manual CSV Import

For any service (Lovable, Replit, etc.):

1. Create a CSV file with columns: `Invoice Number`, `Date`, `Amount`, `Description`, `Currency`
2. Go to **Accounting → Import** tab
3. Upload the CSV file
4. Review and confirm the import

### Creating Manual Invoices

1. Go to **Accounting → Invoices** tab
2. Click **Create Invoice**
3. Fill in:
   - **Type**: Sales Invoice or Purchase Bill
   - **Invoice Number**: Unique identifier
   - **Invoice Date** and **Due Date**
   - **Total Amount**
   - **Notes**: Additional information
4. Click **Create Invoice**

### Recording Payments

1. Go to **Accounting → Payments** tab
2. Click **Record Payment**
3. Fill in:
   - **Payment Type**: Received or Made
   - **Payment Date**
   - **Amount**
   - **Payment Method**: Bank transfer, credit card, etc.
   - **Reference Number**: Check number, transaction ID, etc.
4. Allocate payment to invoices
5. Click **Record Payment**

### Chart of Accounts

The default chart of accounts includes:

**Assets (1000-1999)**
- 1110: Cash
- 1120: Bank Accounts
- 1130: Accounts Receivable
- 1210: Equipment
- 1220: Accumulated Depreciation

**Liabilities (2000-2999)**
- 2110: Accounts Payable
- 2120: Sales Tax Payable
- 2130: Credit Card Payable

**Equity (3000-3999)**
- 3100: Owner Equity
- 3200: Retained Earnings

**Income (4000-4999)**
- 4100: Sales Revenue
- 4200: Service Revenue
- 4300: Other Income

**Expenses (5000-5999)**
- 5110: Software Subscriptions
- 5120: API & Cloud Services
- 5130: Office Supplies
- 5140: Marketing & Advertising
- 5200: Professional Fees
- 5300: Bank Fees

You can customize these accounts in **Accounting → Accounts** tab.

### Generating Financial Reports

1. Go to **Accounting → Reports** tab
2. Select date range:
   - This Month, Last Month, This Quarter, etc.
   - Or choose **Custom Range** for specific dates
3. Choose report type:
   - **P&L**: Profit & Loss Statement
   - **Balance Sheet**: Assets, Liabilities, Equity
   - **General Ledger**: All transactions
   - **Trial Balance**: Verify accounting accuracy
4. Click **Export** to download as PDF or CSV

## API Integration Examples

### Programmatic Import (TypeScript)

```typescript
import { createImporter } from '@/services/accounting/importers';

// Import from Stripe
const stripeImporter = createImporter('stripe', 'sk_test_...');
const result = await stripeImporter?.import('2024-01-01', '2024-01-31');

console.log(`Imported: ${result?.imported}, Failed: ${result?.failed}`);

// Import from CSV
import { ManualCSVImporter } from '@/services/accounting/importers';

const csvContent = `Invoice Number,Date,Amount,Description
INV-001,2024-01-15,99.00,API Usage
INV-002,2024-01-20,149.00,Premium Plan`;

const csvResult = await ManualCSVImporter.import(csvContent, 'custom-service');
```

### Direct Supabase Queries

```typescript
import { supabase } from '@/integrations/supabase/client';

// Get all unpaid invoices
const { data: unpaidInvoices } = await supabase
  .from('invoices')
  .select('*')
  .in('status', ['sent', 'partially_paid', 'overdue'])
  .order('due_date', { ascending: true });

// Get monthly revenue
const { data: revenue } = await supabase
  .from('invoices')
  .select('total_amount')
  .eq('invoice_type', 'sales')
  .eq('status', 'paid')
  .gte('invoice_date', '2024-01-01')
  .lte('invoice_date', '2024-01-31');
```

## Security Considerations

1. **API Key Storage**: API keys are stored in the database. In production, consider using encryption at rest or secret management services like AWS Secrets Manager or HashiCorp Vault.

2. **Row Level Security (RLS)**: All accounting tables have RLS enabled, restricting access to admin users only.

3. **Audit Logging**: All changes are timestamped with `created_at` and `updated_at` fields.

4. **Input Validation**: All monetary amounts are validated and stored as `DECIMAL(15, 2)` to prevent precision issues.

5. **External API Security**:
   - Use restricted API keys with read-only permissions when possible
   - Never commit API keys to version control
   - Rotate keys regularly
   - Monitor API usage for anomalies

## Troubleshooting

### Import Failed

**Problem**: Import shows "failed" status

**Solutions**:
1. Check API key is valid and has correct permissions
2. Verify the service API is accessible
3. Check import logs in **Import → Import History** tab for specific errors
4. Ensure currency exists in the system (add in **Accounts** tab if needed)

### Invoices Not Showing

**Problem**: Imported invoices don't appear in the list

**Solutions**:
1. Check filter settings (Type, Status)
2. Verify RLS policies (ensure you're logged in as admin)
3. Check browser console for errors
4. Refresh the page

### Balance Sheet Doesn't Balance

**Problem**: Assets ≠ Liabilities + Equity

**Solutions**:
1. Run **Trial Balance** report to verify debits = credits
2. Check for unposted journal entries
3. Verify all invoice totals are calculated correctly
4. Check account balances in **Chart of Accounts**

### Payment Not Allocated

**Problem**: Payment recorded but invoice still shows unpaid

**Solutions**:
1. Check **Payment Allocations** table in database
2. Verify payment amount matches invoice amount
3. Create manual payment allocation if needed
4. Check payment date is not in the future

## Future Enhancements

Planned features for future releases:

- [ ] Recurring invoices and subscriptions
- [ ] Multi-company/organization support
- [ ] Bank reconciliation with automatic matching
- [ ] Expense categorization with AI
- [ ] Budget tracking and forecasting
- [ ] Tax filing preparation
- [ ] Custom report builder
- [ ] Mobile app for on-the-go access
- [ ] Real-time currency exchange rate updates
- [ ] Integration with accounting software (QuickBooks, Xero)
- [ ] Advanced analytics and dashboards
- [ ] Automated payment reminders
- [ ] Invoice templates and branding

## Support

For questions or issues with the Accounting Module:

1. Check this documentation first
2. Review the [Living Technical Specification](./LIVING_TECH_SPEC.md)
3. Check the database schema in `/supabase/migrations/20251111000001_accounting_module.sql`
4. Review component code in `/src/components/admin/accounting/`
5. Open an issue on GitHub with detailed information

## Credits

This accounting module is inspired by:
- [Frappe Books](https://github.com/frappe/books) - Open-source accounting software
- Generally Accepted Accounting Principles (GAAP)
- Double-entry bookkeeping best practices

Built with:
- React + TypeScript
- Supabase PostgreSQL
- shadcn/ui components
- Tailwind CSS
