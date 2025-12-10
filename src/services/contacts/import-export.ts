/**
 * Contact Import/Export Service
 *
 * Provides functionality for importing and exporting contacts via CSV files.
 * Supports validation, mapping, and error handling during import.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { validateEmail, validateTextInput } from '@/lib/security';

// Types
export interface Contact {
  id?: string;
  contact_type: 'customer' | 'vendor' | 'both';
  company_name: string | null;
  contact_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  tax_id: string | null;
  currency_id?: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
  contacts: Contact[];
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  data?: Record<string, string>;
}

export interface ImportOptions {
  /** Update existing contacts by email match */
  updateExisting?: boolean;
  /** Skip rows with errors instead of failing */
  skipOnError?: boolean;
  /** Dry run - validate without importing */
  dryRun?: boolean;
  /** Default contact type if not specified */
  defaultContactType?: 'customer' | 'vendor' | 'both';
  /** Custom field mapping */
  fieldMapping?: Record<string, string>;
}

export interface ExportOptions {
  /** Contact type filter */
  contactType?: 'customer' | 'vendor' | 'both' | 'all';
  /** Include inactive contacts */
  includeInactive?: boolean;
  /** Fields to include (all if not specified) */
  fields?: string[];
  /** File name without extension */
  fileName?: string;
}

// CSV field definitions
const CSV_HEADERS = [
  'contact_type',
  'company_name',
  'contact_name',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'postal_code',
  'country',
  'tax_id',
  'payment_terms',
  'notes',
  'is_active',
];

const REQUIRED_FIELDS = ['contact_name'];

const VALID_CONTACT_TYPES = ['customer', 'vendor', 'both'];

// ============================================
// CSV Parsing Utilities
// ============================================

/**
 * Parse CSV string to array of objects
 */
export function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));

  // Parse data rows
  const data: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j]?.trim() || '';
    }

    data.push(row);
  }

  return data;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === ',') {
        // End of field
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  // Add last field
  result.push(current);

  return result;
}

/**
 * Convert array of objects to CSV string
 */
export function toCSV(data: Record<string, unknown>[], headers?: string[]): string {
  if (data.length === 0) return '';

  const fields = headers || Object.keys(data[0]);
  const lines: string[] = [];

  // Header row
  lines.push(fields.map(escapeCSVField).join(','));

  // Data rows
  for (const row of data) {
    const values = fields.map((field) => {
      const value = row[field];
      if (value === null || value === undefined) return '';
      return escapeCSVField(String(value));
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

/**
 * Escape a CSV field value
 */
function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ============================================
// Field Mapping & Validation
// ============================================

/**
 * Default field mappings for common CSV formats
 */
const FIELD_MAPPINGS: Record<string, string> = {
  // Standard variations
  name: 'contact_name',
  fullname: 'contact_name',
  full_name: 'contact_name',
  contact: 'contact_name',
  company: 'company_name',
  organization: 'company_name',
  org: 'company_name',
  type: 'contact_type',
  email_address: 'email',
  mail: 'email',
  telephone: 'phone',
  phone_number: 'phone',
  mobile: 'phone',
  street: 'address',
  street_address: 'address',
  address1: 'address',
  address_1: 'address',
  zip: 'postal_code',
  zipcode: 'postal_code',
  zip_code: 'postal_code',
  postcode: 'postal_code',
  province: 'state',
  region: 'state',
  tax_number: 'tax_id',
  vat: 'tax_id',
  vat_number: 'tax_id',
  ein: 'tax_id',
  terms: 'payment_terms',
  payment: 'payment_terms',
  active: 'is_active',
  status: 'is_active',
  comments: 'notes',
  description: 'notes',
};

/**
 * Map CSV row to contact using field mappings
 */
function mapRowToContact(
  row: Record<string, string>,
  options: ImportOptions
): Partial<Contact> {
  const customMapping = options.fieldMapping || {};
  const mappings = { ...FIELD_MAPPINGS, ...customMapping };

  const contact: Partial<Contact> = {};

  for (const [csvField, value] of Object.entries(row)) {
    // Get the target field
    const targetField = mappings[csvField] || csvField;

    // Only map to valid contact fields
    if (CSV_HEADERS.includes(targetField)) {
      (contact as Record<string, unknown>)[targetField] = value;
    }
  }

  return contact;
}

/**
 * Validate and sanitize a contact
 */
function validateContact(
  contact: Partial<Contact>,
  rowIndex: number,
  options: ImportOptions
): { valid: boolean; errors: ImportError[]; contact: Contact | null } {
  const errors: ImportError[] = [];

  // Validate required fields
  for (const field of REQUIRED_FIELDS) {
    if (!contact[field as keyof Contact]) {
      errors.push({
        row: rowIndex,
        field,
        message: `${field} is required`,
      });
    }
  }

  // Validate contact name
  const contactName = validateTextInput(contact.contact_name || '', 200);
  if (!contactName && contact.contact_name) {
    errors.push({
      row: rowIndex,
      field: 'contact_name',
      message: 'Invalid contact name',
    });
  }

  // Validate email if provided
  if (contact.email) {
    const email = validateEmail(contact.email);
    if (!email) {
      errors.push({
        row: rowIndex,
        field: 'email',
        message: 'Invalid email format',
      });
    }
    contact.email = email;
  }

  // Validate contact type
  let contactType = (contact.contact_type || options.defaultContactType || 'customer').toLowerCase();
  if (!VALID_CONTACT_TYPES.includes(contactType)) {
    contactType = options.defaultContactType || 'customer';
  }

  // Parse is_active
  let isActive = true;
  if (contact.is_active !== undefined) {
    const activeStr = String(contact.is_active).toLowerCase();
    isActive = !['false', '0', 'no', 'inactive'].includes(activeStr);
  }

  if (errors.length > 0) {
    return { valid: false, errors, contact: null };
  }

  // Build validated contact
  const validatedContact: Contact = {
    contact_type: contactType as 'customer' | 'vendor' | 'both',
    company_name: validateTextInput(contact.company_name || '', 200) || null,
    contact_name: contactName!,
    email: contact.email || null,
    phone: validateTextInput(contact.phone || '', 50) || null,
    address: validateTextInput(contact.address || '', 500) || null,
    city: validateTextInput(contact.city || '', 100) || null,
    state: validateTextInput(contact.state || '', 100) || null,
    postal_code: validateTextInput(contact.postal_code || '', 20) || null,
    country: validateTextInput(contact.country || '', 100) || null,
    tax_id: validateTextInput(contact.tax_id || '', 50) || null,
    payment_terms: validateTextInput(contact.payment_terms || '', 50) || null,
    notes: validateTextInput(contact.notes || '', 2000) || null,
    is_active: isActive,
  };

  return { valid: true, errors: [], contact: validatedContact };
}

// ============================================
// Import Functions
// ============================================

/**
 * Import contacts from CSV file
 */
export async function importContactsFromCSV(
  file: File,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    contacts: [],
  };

  try {
    // Read file content
    const content = await file.text();

    // Parse CSV
    const rows = parseCSV(content);
    logger.log(`Parsed ${rows.length} rows from CSV`);

    // Get existing contacts for duplicate detection
    let existingContacts: Contact[] = [];
    if (options.updateExisting) {
      const { data } = await supabase
        .from('contacts')
        .select('id, email, contact_name');
      existingContacts = (data as Contact[]) || [];
    }

    // Process each row
    const contactsToInsert: Contact[] = [];
    const contactsToUpdate: { id: string; data: Partial<Contact> }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2; // Account for header row and 0-indexing

      // Map row to contact
      const mappedContact = mapRowToContact(row, options);

      // Validate contact
      const validation = validateContact(mappedContact, rowIndex, options);

      if (!validation.valid) {
        result.errors.push(...validation.errors.map((e) => ({ ...e, data: row })));

        if (options.skipOnError) {
          result.skipped++;
          continue;
        } else {
          result.success = false;
          return result;
        }
      }

      const contact = validation.contact!;

      // Check for existing contact
      if (options.updateExisting && contact.email) {
        const existing = existingContacts.find(
          (c) => c.email?.toLowerCase() === contact.email?.toLowerCase()
        );

        if (existing) {
          contactsToUpdate.push({ id: existing.id!, data: contact });
          continue;
        }
      }

      contactsToInsert.push(contact);
    }

    // Perform import if not dry run
    if (!options.dryRun) {
      // Insert new contacts
      if (contactsToInsert.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from('contacts')
          .insert(contactsToInsert)
          .select();

        if (insertError) {
          throw insertError;
        }

        result.imported = inserted?.length || 0;
        result.contacts.push(...((inserted as Contact[]) || []));
      }

      // Update existing contacts
      for (const update of contactsToUpdate) {
        const { error: updateError } = await supabase
          .from('contacts')
          .update(update.data)
          .eq('id', update.id);

        if (updateError) {
          result.errors.push({
            row: 0,
            message: `Failed to update contact: ${updateError.message}`,
          });
        } else {
          result.updated++;
        }
      }
    } else {
      // Dry run - just report what would be imported
      result.imported = contactsToInsert.length;
      result.updated = contactsToUpdate.length;
      result.contacts = contactsToInsert;
    }

    logger.log('Import complete:', {
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    logger.error('Import error:', error);
    result.success = false;
    result.errors.push({
      row: 0,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return result;
  }
}

/**
 * Validate a CSV file without importing
 */
export async function validateContactsCSV(
  file: File,
  options: ImportOptions = {}
): Promise<ImportResult> {
  return importContactsFromCSV(file, { ...options, dryRun: true });
}

// ============================================
// Export Functions
// ============================================

/**
 * Export contacts to CSV file
 */
export async function exportContactsToCSV(
  options: ExportOptions = {}
): Promise<{ blob: Blob; fileName: string } | null> {
  try {
    const {
      contactType = 'all',
      includeInactive = false,
      fields,
      fileName = `contacts_export_${new Date().toISOString().split('T')[0]}`,
    } = options;

    // Build query
    let query = supabase.from('contacts').select('*');

    if (contactType !== 'all') {
      query = query.or(`contact_type.eq.${contactType},contact_type.eq.both`);
    }

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    query = query.order('contact_name', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      logger.warn('No contacts to export');
      return null;
    }

    // Filter fields if specified
    const exportFields = fields || CSV_HEADERS;
    const exportData = data.map((contact) => {
      const row: Record<string, unknown> = {};
      for (const field of exportFields) {
        row[field] = contact[field as keyof typeof contact];
      }
      return row;
    });

    // Convert to CSV
    const csvContent = toCSV(exportData, exportFields);

    // Create blob
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    return {
      blob,
      fileName: `${fileName}.csv`,
    };
  } catch (error) {
    logger.error('Export error:', error);
    return null;
  }
}

/**
 * Download contacts as CSV file
 */
export async function downloadContactsCSV(options: ExportOptions = {}): Promise<boolean> {
  const result = await exportContactsToCSV(options);

  if (!result) {
    return false;
  }

  // Create download link
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true;
}

/**
 * Get a sample CSV template for import
 */
export function getImportTemplate(): string {
  const sampleData = [
    {
      contact_type: 'customer',
      company_name: 'Acme Corp',
      contact_name: 'John Doe',
      email: 'john.doe@acme.com',
      phone: '+1-555-123-4567',
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      postal_code: '10001',
      country: 'United States',
      tax_id: '',
      payment_terms: 'Net 30',
      notes: 'Primary contact',
      is_active: 'true',
    },
    {
      contact_type: 'vendor',
      company_name: 'Tech Supplies Inc',
      contact_name: 'Jane Smith',
      email: 'jane@techsupplies.com',
      phone: '+1-555-987-6543',
      address: '456 Oak Ave',
      city: 'San Francisco',
      state: 'CA',
      postal_code: '94102',
      country: 'United States',
      tax_id: '12-3456789',
      payment_terms: 'Net 60',
      notes: 'Hardware supplier',
      is_active: 'true',
    },
  ];

  return toCSV(sampleData, CSV_HEADERS);
}

/**
 * Download sample CSV template
 */
export function downloadImportTemplate(): void {
  const csvContent = getImportTemplate();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'contacts_import_template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
