-- =====================================================
-- Accounting Documents Table
-- Tracks uploaded documents with OCR and AI parsing
-- =====================================================

-- Create storage bucket for accounting documents (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('accounting-documents', 'accounting-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for accounting documents
CREATE POLICY "Authenticated users can upload accounting documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'accounting-documents');

CREATE POLICY "Authenticated users can view accounting documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'accounting-documents');

CREATE POLICY "Authenticated users can update accounting documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'accounting-documents');

CREATE POLICY "Authenticated users can delete accounting documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'accounting-documents');

-- =====================================================
-- ACCOUNTING DOCUMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.accounting_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- File information
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Path in Supabase storage
  file_size INTEGER NOT NULL, -- Size in bytes
  file_type TEXT NOT NULL, -- MIME type (application/pdf, image/jpeg, etc.)

  -- Document classification
  document_type TEXT NOT NULL CHECK (document_type IN (
    'invoice', 'bill', 'receipt', 'payment_proof',
    'bank_statement', 'contract', 'tax_document', 'other'
  )),

  -- Related entity (polymorphic association)
  related_entity_type TEXT CHECK (related_entity_type IN (
    'invoice', 'payment', 'journal_entry', 'contact', 'expense', 'none'
  )),
  related_entity_id UUID, -- ID of the related entity

  -- OCR data
  ocr_status TEXT DEFAULT 'pending' CHECK (ocr_status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  ocr_text TEXT, -- Raw extracted text from OCR
  ocr_confidence DECIMAL(5, 2), -- Overall confidence score (0-100)
  ocr_language TEXT, -- Detected language
  ocr_processed_at TIMESTAMPTZ,

  -- AI parsed data
  ai_parsed_data JSONB, -- Structured data extracted by AI
  ai_confidence DECIMAL(5, 2), -- AI parsing confidence (0-100)
  ai_status TEXT DEFAULT 'pending' CHECK (ai_status IN (
    'pending', 'processing', 'completed', 'failed', 'skipped'
  )),
  ai_processed_at TIMESTAMPTZ,

  -- Extracted key information (for quick access)
  extracted_date DATE, -- Document date
  extracted_amount DECIMAL(15, 2), -- Total amount
  extracted_vendor TEXT, -- Vendor/Customer name
  extracted_invoice_number TEXT, -- Invoice/Receipt number

  -- User and timestamps
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT, -- User notes about the document
  tags TEXT[], -- User-defined tags

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_accounting_documents_related_entity
  ON public.accounting_documents(related_entity_type, related_entity_id);

CREATE INDEX idx_accounting_documents_document_type
  ON public.accounting_documents(document_type);

CREATE INDEX idx_accounting_documents_ocr_status
  ON public.accounting_documents(ocr_status);

CREATE INDEX idx_accounting_documents_ai_status
  ON public.accounting_documents(ai_status);

CREATE INDEX idx_accounting_documents_uploaded_by
  ON public.accounting_documents(uploaded_by);

CREATE INDEX idx_accounting_documents_created_at
  ON public.accounting_documents(created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_accounting_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounting_documents_updated_at
  BEFORE UPDATE ON public.accounting_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_accounting_documents_updated_at();

-- Enable Row Level Security
ALTER TABLE public.accounting_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all accounting documents"
  ON public.accounting_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert accounting documents"
  ON public.accounting_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update accounting documents"
  ON public.accounting_documents FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete their own accounting documents"
  ON public.accounting_documents FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- Add comments for documentation
COMMENT ON TABLE public.accounting_documents IS 'Stores metadata and OCR/AI parsed data for uploaded accounting documents';
COMMENT ON COLUMN public.accounting_documents.ocr_text IS 'Raw text extracted from document using OCR';
COMMENT ON COLUMN public.accounting_documents.ai_parsed_data IS 'Structured data extracted by AI (JSON format with document-specific fields)';
COMMENT ON COLUMN public.accounting_documents.related_entity_type IS 'Type of entity this document is attached to (invoice, payment, etc.)';
COMMENT ON COLUMN public.accounting_documents.related_entity_id IS 'ID of the related entity';
