# Document Upload with OCR and AI Parsing Feature

## Overview

This feature enables automatic document processing with OCR (Optical Character Recognition) and AI-powered data extraction for accounting documents. Users can upload invoices, receipts, bills, and other financial documents, which are then automatically processed to extract structured data.

## Architecture

### Components

1. **Database Layer** (`supabase/migrations/20251121000002_accounting_documents.sql`)
   - `accounting_documents` table for tracking uploaded documents
   - Supabase Storage bucket: `accounting-documents`
   - Full-text OCR storage and AI-parsed structured data

2. **Edge Function** (`supabase/functions/process-accounting-document/index.ts`)
   - OCR processing using Google Gemini 2.0 Flash (vision model)
   - AI parsing using Google Gemini 2.5 Flash
   - Document-type-specific extraction prompts
   - Automatic data extraction and storage

3. **React Component** (`src/components/admin/accounting/DocumentUpload.tsx`)
   - Reusable upload interface
   - Real-time processing status
   - Document preview and management
   - Parsed data viewer

4. **Integration Points**
   - `InvoicesManager.tsx` - Upload invoices and bills
   - `PaymentsManager.tsx` - Upload payment proofs and receipts

## Database Schema

### `accounting_documents` Table

```sql
- id (UUID, primary key)
- file_name (TEXT) - Original filename
- file_path (TEXT) - Path in Supabase storage
- file_size (INTEGER) - Size in bytes
- file_type (TEXT) - MIME type
- document_type (TEXT) - invoice, bill, receipt, payment_proof, etc.
- related_entity_type (TEXT) - invoice, payment, journal_entry, etc.
- related_entity_id (UUID) - Foreign key to related entity
- ocr_status (TEXT) - pending, processing, completed, failed
- ocr_text (TEXT) - Raw extracted text
- ocr_confidence (DECIMAL) - OCR accuracy score
- ai_status (TEXT) - pending, processing, completed, failed, skipped
- ai_parsed_data (JSONB) - Structured extracted data
- extracted_date (DATE) - Quick-access document date
- extracted_amount (DECIMAL) - Quick-access total amount
- extracted_vendor (TEXT) - Quick-access vendor/merchant name
- extracted_invoice_number (TEXT) - Quick-access document number
- uploaded_by (UUID) - User who uploaded
- notes (TEXT) - User notes
- tags (TEXT[]) - User-defined tags
- created_at, updated_at (TIMESTAMPTZ)
```

## Usage

### 1. Upload Document

```typescript
import { DocumentUpload } from '@/components/admin/accounting/DocumentUpload';

<DocumentUpload
  documentType="invoice"
  relatedEntityType="invoice"
  relatedEntityId={invoiceId}
  autoProcess={true}
  showExistingDocuments={true}
  onUploadComplete={(documentId, parsedData) => {
    console.log('Parsed data:', parsedData);
  }}
/>
```

### 2. Supported Document Types

- **invoice** - Sales invoices and purchase bills
- **receipt** - Store receipts and transaction confirmations
- **payment_proof** - Bank transfers, payment confirmations
- **bank_statement** - Bank account statements
- **contract** - Business contracts
- **tax_document** - Tax forms and documents
- **other** - General financial documents

### 3. Supported File Formats

- PDF (`.pdf`)
- Images: JPEG (`.jpg`, `.jpeg`), PNG (`.png`), GIF (`.gif`), WebP (`.webp`)
- Maximum file size: 10MB

## AI Extraction

### Invoice/Bill Extraction

Extracts:
- Invoice number
- Invoice date and due date
- Vendor and customer information
- Addresses
- Line items (description, quantity, unit price, amount)
- Subtotal, tax, discount, total
- Currency and payment terms
- Notes and payment instructions

### Receipt Extraction

Extracts:
- Merchant name and location
- Receipt/transaction number
- Transaction date and time
- Items purchased (name, quantity, price)
- Subtotal, tax, tip, total
- Payment method

### Payment Proof Extraction

Extracts:
- Payment/transaction number
- Payment date
- Payer and payee names
- Amount and currency
- Payment method
- Reference/memo
- Bank information
- Payment status

### Bank Statement Extraction

Extracts:
- Bank name and account information
- Account holder name
- Statement period
- Opening and closing balance
- Transaction list (date, description, amount, balance)

## Processing Flow

1. **Upload**: User selects file and document type
2. **Storage**: File uploaded to Supabase Storage (`accounting-documents` bucket)
3. **Record Creation**: Metadata saved to `accounting_documents` table
4. **OCR Processing**:
   - File downloaded from storage
   - Converted to base64
   - Sent to Gemini 2.0 Flash (vision) for text extraction
   - OCR text saved with confidence score
5. **AI Parsing**:
   - OCR text sent to Gemini 2.5 Flash with document-type-specific prompt
   - Structured JSON data extracted
   - Parsed data saved to database
6. **Quick Access Fields**: Key fields (date, amount, vendor, number) extracted for fast querying
7. **Completion**: User notified and parsed data returned

## API Reference

### Edge Function: `process-accounting-document`

**Endpoint**: `/functions/v1/process-accounting-document`

**Request Body**:
```json
{
  "documentId": "uuid",
  "documentType": "invoice|bill|receipt|payment_proof|bank_statement|contract|tax_document|other",
  "relatedEntityType": "invoice|payment|journal_entry|contact|expense|none",
  "relatedEntityId": "uuid (optional)"
}
```

**Response**:
```json
{
  "success": true,
  "document": { /* updated document record */ },
  "ocr_text_length": 1234,
  "parsed_data": { /* structured extracted data */ },
  "message": "Document processed successfully"
}
```

## Security

### Storage Policies

- **Upload**: Authenticated users only
- **View**: Authenticated users only
- **Update**: Authenticated users only
- **Delete**: Authenticated users only

### Row Level Security (RLS)

- **SELECT**: All authenticated users can view documents
- **INSERT**: All authenticated users can create documents
- **UPDATE**: All authenticated users can update documents
- **DELETE**: Users can only delete their own uploaded documents

### Validation

- File type validation (PDF and images only)
- File size limit (10MB maximum)
- Document type enum validation
- Input sanitization for all user inputs

## Performance Considerations

1. **Async Processing**: OCR and AI parsing run asynchronously
2. **Progress Indicators**: Real-time status updates (pending → processing → completed)
3. **Error Handling**: Failed processing captured with error status
4. **Caching**: Processed documents cached in database
5. **Indexes**: Database indexes on commonly queried fields

## Future Enhancements

- [ ] Auto-populate invoice/payment forms with parsed data
- [ ] Batch document upload
- [ ] Document versioning
- [ ] Multi-page PDF support with page-by-page extraction
- [ ] Custom extraction templates
- [ ] Document search by OCR text
- [ ] Confidence score thresholds for auto-approval
- [ ] Machine learning model for improved accuracy over time
- [ ] Support for non-English documents
- [ ] Integration with accounting software APIs

## Troubleshooting

### Upload Fails

- Check file size (must be < 10MB)
- Verify file type (PDF or image)
- Ensure Supabase storage bucket exists and has correct policies
- Check user authentication status

### OCR Processing Fails

- Verify `LOVABLE_API_KEY` environment variable is set
- Check image quality (low quality may cause failures)
- Ensure document is not password-protected
- Check Supabase function logs for errors

### AI Parsing Returns Incomplete Data

- OCR text may be incomplete or inaccurate
- Document format may not match expected structure
- Try uploading a higher quality image
- Check parsed data in database for raw OCR text

### Performance Issues

- Large files (>5MB) may take longer to process
- PDF files typically take longer than images
- Multiple concurrent uploads may slow processing
- Consider implementing queue system for high volume

## Testing

### Manual Testing Checklist

- [ ] Upload invoice PDF
- [ ] Upload receipt image (JPEG, PNG)
- [ ] Test with various document types
- [ ] Verify OCR accuracy
- [ ] Verify AI parsing accuracy
- [ ] Test file size validation (>10MB should fail)
- [ ] Test unsupported file types (.docx, .txt should fail)
- [ ] Test document download
- [ ] Test document deletion
- [ ] Test viewing parsed data
- [ ] Test integration with InvoicesManager
- [ ] Test integration with PaymentsManager

### Example Test Documents

Use real or mock documents:
- Sample invoice (PDF or image)
- Sample receipt (image)
- Sample payment confirmation (PDF)
- Sample bank statement (PDF)

## Monitoring

### Key Metrics to Track

- Upload success rate
- OCR accuracy (confidence scores)
- AI parsing success rate
- Average processing time
- Storage usage
- API costs (Gemini usage)

### Logs

Check Supabase Edge Function logs:
```bash
supabase functions logs process-accounting-document
```

## Cost Considerations

### Supabase

- Storage: ~$0.021/GB/month
- Bandwidth: ~$0.09/GB

### AI API (Lovable/Google Gemini)

- Gemini 2.0 Flash (Vision): Cost per image/PDF
- Gemini 2.5 Flash (Text): Cost per token
- Costs vary based on volume

### Optimization Tips

- Compress images before upload
- Use appropriate image resolution (300 DPI for text)
- Consider batching documents
- Implement caching to avoid re-processing

## Support

For issues or questions:
- Check Supabase logs for errors
- Review database records for failed documents
- Check Edge Function logs for processing errors
- Verify API keys and environment variables

## Changelog

### Version 1.0.0 (2025-11-21)

- Initial implementation
- Support for invoices, receipts, payment proofs, bank statements
- OCR with Google Gemini 2.0 Flash
- AI parsing with Google Gemini 2.5 Flash
- Integration with InvoicesManager and PaymentsManager
- Document management UI (view, download, delete)
- Structured data extraction and storage
