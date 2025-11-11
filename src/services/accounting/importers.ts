/**
 * Invoice Import Services
 *
 * This module provides utilities for importing invoices from various external services
 * like Stripe, OpenAI, Anthropic, Lovable, and Replit.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// =====================================================
// Types
// =====================================================

export interface ImportedInvoice {
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  total_amount: number;
  currency: string;
  status: string;
  description?: string;
  items: ImportedInvoiceItem[];
  external_id: string;
  external_url?: string;
  metadata?: Record<string, any>;
}

export interface ImportedInvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  metadata?: Record<string, any>;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}

// =====================================================
// Base Importer Class
// =====================================================

export abstract class BaseInvoiceImporter {
  protected sourceName: string;
  protected apiKey: string;

  constructor(sourceName: string, apiKey: string) {
    this.sourceName = sourceName;
    this.apiKey = apiKey;
  }

  abstract fetchInvoices(startDate?: string, endDate?: string): Promise<ImportedInvoice[]>;

  async import(startDate?: string, endDate?: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Fetch invoices from external source
      const invoices = await this.fetchInvoices(startDate, endDate);
      logger.info(`Fetched ${invoices.length} invoices from ${this.sourceName}`);

      // Import each invoice
      for (const invoice of invoices) {
        try {
          await this.importInvoice(invoice);
          result.imported++;
        } catch (error) {
          result.failed++;
          result.errors.push(`Failed to import ${invoice.invoice_number}: ${error}`);
          logger.error(`Error importing invoice ${invoice.invoice_number}:`, error);
        }
      }

      result.success = result.failed === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(`Failed to fetch invoices: ${error}`);
      logger.error(`Error fetching invoices from ${this.sourceName}:`, error);
    }

    return result;
  }

  private async importInvoice(invoice: ImportedInvoice): Promise<void> {
    // Check if invoice already exists
    const { data: existing } = await supabase
      .from('invoices')
      .select('id')
      .eq('external_id', invoice.external_id)
      .eq('import_source', this.sourceName)
      .single();

    if (existing) {
      logger.info(`Invoice ${invoice.invoice_number} already exists, skipping`);
      return;
    }

    // Get or create currency
    const { data: currency } = await supabase
      .from('currencies')
      .select('id')
      .eq('code', invoice.currency.toUpperCase())
      .single();

    const currencyId = currency?.id;

    // Insert invoice
    const { data: insertedInvoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert([
        {
          invoice_type: 'purchase', // Imported invoices are typically expenses
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date,
          currency_id: currencyId,
          subtotal: invoice.total_amount,
          total_amount: invoice.total_amount,
          amount_due: invoice.total_amount,
          status: this.mapStatus(invoice.status),
          import_source: this.sourceName,
          external_id: invoice.external_id,
          external_url: invoice.external_url,
          imported_at: new Date().toISOString(),
          notes: invoice.description,
          metadata: invoice.metadata,
        },
      ])
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Insert invoice items
    if (invoice.items.length > 0) {
      const items = invoice.items.map((item, index) => ({
        invoice_id: insertedInvoice.id,
        line_number: index + 1,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.total,
        metadata: item.metadata,
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(items);

      if (itemsError) throw itemsError;
    }

    logger.info(`Successfully imported invoice ${invoice.invoice_number}`);
  }

  private mapStatus(externalStatus: string): string {
    const statusMap: Record<string, string> = {
      paid: 'paid',
      open: 'sent',
      draft: 'draft',
      uncollectible: 'cancelled',
      void: 'void',
    };

    return statusMap[externalStatus.toLowerCase()] || 'sent';
  }
}

// =====================================================
// Stripe Importer
// =====================================================

export class StripeInvoiceImporter extends BaseInvoiceImporter {
  constructor(apiKey: string) {
    super('stripe', apiKey);
  }

  async fetchInvoices(startDate?: string, endDate?: string): Promise<ImportedInvoice[]> {
    try {
      const params = new URLSearchParams({
        limit: '100',
      });

      if (startDate) {
        params.append('created[gte]', String(Math.floor(new Date(startDate).getTime() / 1000)));
      }
      if (endDate) {
        params.append('created[lte]', String(Math.floor(new Date(endDate).getTime() / 1000)));
      }

      const response = await fetch(`https://api.stripe.com/v1/invoices?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Stripe API error: ${response.statusText}`);
      }

      const data = await response.json();

      return data.data.map((inv: any) => ({
        invoice_number: inv.number || inv.id,
        invoice_date: new Date(inv.created * 1000).toISOString().split('T')[0],
        due_date: inv.due_date ? new Date(inv.due_date * 1000).toISOString().split('T')[0] : undefined,
        total_amount: inv.total / 100, // Stripe amounts are in cents
        currency: inv.currency.toUpperCase(),
        status: inv.status,
        description: inv.description || 'Stripe Invoice',
        items: inv.lines.data.map((line: any) => ({
          description: line.description || 'Line item',
          quantity: line.quantity,
          unit_price: line.price.unit_amount / 100,
          total: line.amount / 100,
          metadata: {
            product_id: line.price.product,
          },
        })),
        external_id: inv.id,
        external_url: inv.hosted_invoice_url,
        metadata: {
          customer_id: inv.customer,
          subscription_id: inv.subscription,
        },
      }));
    } catch (error) {
      logger.error('Error fetching Stripe invoices:', error);
      throw error;
    }
  }
}

// =====================================================
// OpenAI Importer
// =====================================================

export class OpenAIInvoiceImporter extends BaseInvoiceImporter {
  constructor(apiKey: string) {
    super('openai', apiKey);
  }

  async fetchInvoices(startDate?: string, endDate?: string): Promise<ImportedInvoice[]> {
    // Note: OpenAI doesn't have a direct billing API yet
    // This is a placeholder implementation
    // In practice, you might need to use their dashboard or export CSV

    logger.warn('OpenAI invoice import requires manual CSV export from dashboard');
    return [];
  }
}

// =====================================================
// Anthropic (Claude) Importer
// =====================================================

export class AnthropicInvoiceImporter extends BaseInvoiceImporter {
  constructor(apiKey: string) {
    super('anthropic', apiKey);
  }

  async fetchInvoices(startDate?: string, endDate?: string): Promise<ImportedInvoice[]> {
    // Note: Anthropic doesn't have a public billing API yet
    // This is a placeholder implementation
    // In practice, you might need to use their console or export data

    logger.warn('Anthropic invoice import requires manual export from console');
    return [];
  }
}

// =====================================================
// Manual CSV Importer
// =====================================================

export class ManualCSVImporter {
  static async parseCSV(csvContent: string, sourceName: string): Promise<ImportedInvoice[]> {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());

    const invoices: ImportedInvoice[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      invoices.push({
        invoice_number: row['Invoice Number'] || row['invoice_number'] || `INV-${Date.now()}-${i}`,
        invoice_date: row['Date'] || row['invoice_date'] || new Date().toISOString().split('T')[0],
        due_date: row['Due Date'] || row['due_date'],
        total_amount: parseFloat(row['Amount'] || row['total_amount'] || '0'),
        currency: row['Currency'] || row['currency'] || 'USD',
        status: row['Status'] || row['status'] || 'sent',
        description: row['Description'] || row['description'],
        items: [{
          description: row['Description'] || row['description'] || 'Imported item',
          quantity: 1,
          unit_price: parseFloat(row['Amount'] || row['total_amount'] || '0'),
          total: parseFloat(row['Amount'] || row['total_amount'] || '0'),
        }],
        external_id: `${sourceName}-${row['Invoice Number'] || Date.now()}-${i}`,
        metadata: { source: sourceName, csv_row: i },
      });
    }

    return invoices;
  }

  static async import(csvContent: string, sourceName: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
    };

    try {
      const invoices = await this.parseCSV(csvContent, sourceName);
      const importer = new (class extends BaseInvoiceImporter {
        async fetchInvoices() { return invoices; }
      })(sourceName, '');

      return await importer.import();
    } catch (error) {
      result.success = false;
      result.errors.push(`Failed to parse CSV: ${error}`);
      logger.error('Error parsing CSV:', error);
    }

    return result;
  }
}

// =====================================================
// Factory Function
// =====================================================

export function createImporter(source: string, apiKey: string): BaseInvoiceImporter | null {
  switch (source.toLowerCase()) {
    case 'stripe':
      return new StripeInvoiceImporter(apiKey);
    case 'openai':
      return new OpenAIInvoiceImporter(apiKey);
    case 'anthropic':
      return new AnthropicInvoiceImporter(apiKey);
    default:
      return null;
  }
}
