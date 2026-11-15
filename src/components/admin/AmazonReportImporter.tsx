import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, FileText, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AmazonReportRecord {
  date: string;
  asin: string;
  quantity: number;
  revenue: number;
  commission: number;
}

interface AmazonAffiliateStats {
  date: string;
  asin: string;
  article_id: string | null;
  clicks: number;
  orders: number;
  revenue: number;
  commission: number;
}

/** Rows per upsert request. */
const UPSERT_CHUNK = 500;
/** ASINs per .in() filter, which travels in the URL of a GET. */
const LOOKUP_CHUNK = 200;
/** PostgREST max_rows (supabase/config.toml). */
const PAGE_SIZE = 1000;

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const statKey = (articleId: string | null, asin: string, date: string) =>
  `${articleId ?? ''}|${asin}|${date}`;

const cents = (n: number) => Math.round(n * 100) / 100;

interface ImportCounts {
  inserted: number;
  updated: number;
  failed: number;
  firstError: string | null;
}

/**
 * Write aggregated report rows with a fixed number of requests: one article
 * lookup and one existing-row lookup per 200 ASINs, then one upsert per 500
 * rows. Lookup errors abort before anything is written; an upsert error
 * marks that chunk failed and the rest still go through.
 */
async function writeStats(records: AmazonReportRecord[]): Promise<ImportCounts> {
  // Aggregate by (date, ASIN).
  const byKey = new Map<string, Omit<AmazonAffiliateStats, 'article_id' | 'clicks'>>();
  for (const record of records) {
    const key = `${record.date}|${record.asin}`;
    const stat = byKey.get(key) ?? {
      date: record.date,
      asin: record.asin,
      orders: 0,
      revenue: 0,
      commission: 0,
    };
    stat.orders += record.quantity;
    stat.revenue += record.revenue;
    stat.commission += record.commission;
    byKey.set(key, stat);
  }

  const aggregated = Array.from(byKey.values());
  const asins = Array.from(new Set(aggregated.map((s) => s.asin)));
  const dates = aggregated.map((s) => s.date).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  // ASIN -> article. An ASIN in several articles goes to the oldest link,
  // so re-imports land on the same row every time.
  const articleByAsin = new Map<string, string>();
  for (const part of chunk(asins, LOOKUP_CHUNK)) {
    const { data, error } = await supabase
      .from('article_products')
      .select('asin, article_id')
      .in('asin', part)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Article lookup failed: ${error.message}`);
    for (const row of data ?? []) {
      if (!articleByAsin.has(row.asin)) articleByAsin.set(row.asin, row.article_id);
    }
  }

  const rows: AmazonAffiliateStats[] = aggregated.map((s) => ({
    ...s,
    article_id: articleByAsin.get(s.asin) ?? null,
    clicks: 0,
    revenue: cents(s.revenue),
    commission: cents(s.commission),
  }));

  // Which rows exist already, only to report new vs updated.
  const existing = new Set<string>();
  for (const part of chunk(asins, LOOKUP_CHUNK)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('amazon_affiliate_stats')
        .select('article_id, asin, date')
        .in('asin', part)
        .gte('date', minDate)
        .lte('date', maxDate)
        .order('id')
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`Existing stats lookup failed: ${error.message}`);
      for (const row of data ?? []) existing.add(statKey(row.article_id, row.asin, row.date));
      if (!data || data.length < PAGE_SIZE) break;
    }
  }

  const counts: ImportCounts = { inserted: 0, updated: 0, failed: 0, firstError: null };
  for (const part of chunk(rows, UPSERT_CHUNK)) {
    // clicks is left out so an update keeps the click count the tracker wrote.
    const payload = part.map(({ clicks: _clicks, ...rest }) => rest);
    const { error } = await supabase
      .from('amazon_affiliate_stats')
      .upsert(payload, { onConflict: 'article_id,asin,date' });
    if (error) {
      logger.error('Amazon stats upsert failed:', error);
      counts.failed += part.length;
      counts.firstError ??= error.message;
      continue;
    }
    for (const row of part) {
      if (existing.has(statKey(row.article_id, row.asin, row.date))) counts.updated++;
      else counts.inserted++;
    }
  }
  return counts;
}

interface AmazonReportImporterProps {
  /** Called after any rows were written, so the parent can reload. */
  onImported?: () => void;
}

export const AmazonReportImporter = ({ onImported }: AmazonReportImporterProps = {}) => {
  const queryClient = useQueryClient();
  const [isImporting, setIsImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.txt')) {
        toast.error('Please select a CSV or TXT file');
        return;
      }
      setFile(selectedFile);
    }
  };

  const parseAmazonReport = async (text: string) => {
    const lines = text.split('\n').filter((line) => line.trim());

    if (lines.length === 0) {
      throw new Error('Empty file');
    }

    // Amazon Associates reports typically have headers in first row
    const headers = lines[0].split('\t').map((h) => h.trim().toLowerCase());

    // Find column indexes
    const dateIdx = headers.findIndex((h) => h.includes('date') || h.includes('shipped'));
    const asinIdx = headers.findIndex((h) => h.includes('asin'));
    const quantityIdx = headers.findIndex((h) => h.includes('quantity') || h.includes('items'));
    const revenueIdx = headers.findIndex((h) => h.includes('revenue') || h.includes('price'));
    const commissionIdx = headers.findIndex(
      (h) => h.includes('commission') || h.includes('earnings')
    );

    if (dateIdx === -1 || asinIdx === -1) {
      throw new Error(
        'Could not find required columns (Date, ASIN). Make sure you uploaded an Amazon Associates order report.'
      );
    }

    const records: AmazonReportRecord[] = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');

      if (values.length < 2) continue;

      const asin = values[asinIdx]?.trim();
      const dateStr = values[dateIdx]?.trim();

      if (!asin || !dateStr) continue;

      // Parse date (handle various formats)
      let date: Date;
      try {
        date = new Date(dateStr);
        if (isNaN(date.getTime())) continue;
      } catch {
        continue;
      }

      const quantity = quantityIdx !== -1 ? parseInt(values[quantityIdx]) || 1 : 1;
      const revenue =
        revenueIdx !== -1 ? parseFloat(values[revenueIdx]?.replace(/[$,]/g, '') || '0') : 0;
      const commission =
        commissionIdx !== -1 ? parseFloat(values[commissionIdx]?.replace(/[$,]/g, '') || '0') : 0;

      records.push({
        date: date.toISOString().split('T')[0],
        asin,
        quantity,
        revenue,
        commission,
      });
    }

    return records;
  };

  const importReport = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      const records = await parseAmazonReport(text);

      if (records.length === 0) {
        toast.error('No valid records found in file');
        return;
      }

      const { inserted, updated, failed, firstError } = await writeStats(records);
      const written = inserted + updated;

      if (written > 0) {
        void queryClient.invalidateQueries({ queryKey: ['amazon_stats'] });
        onImported?.();
      }

      const summary = `${inserted} new, ${updated} updated`;
      if (failed === 0) {
        toast.success(`Imported ${written} rows: ${summary}`);
      } else if (written === 0) {
        toast.error(`Import failed: all ${failed} rows were rejected. ${firstError ?? ''}`.trim());
        return;
      } else {
        // Keep the file selected: the upsert is idempotent, so retrying is safe.
        toast.warning(
          `Imported ${written} rows (${summary}); ${failed} failed. ${firstError ?? ''}`.trim()
        );
        return;
      }
      setFile(null);

      // Reset file input
      const fileInput = document.getElementById('report-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      logger.error('Import error:', error);
      toast.error(`Import failed: ${(error as Error).message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Import Amazon Associates Report
        </CardTitle>
        <CardDescription>
          Upload order reports from Amazon Associates Central to track conversions and earnings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">How to get your report:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>
                  Go to{' '}
                  <a
                    href="https://affiliate-program.amazon.com/home/reports"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Amazon Associates Reports
                  </a>
                </li>
                <li>Select "Orders Report" → Choose date range</li>
                <li>Download as Tab-delimited (TXT) or CSV</li>
                <li>Upload the file below</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                The importer will automatically match ASINs to your articles and update conversion
                data.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <label
            htmlFor="report-file"
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {file ? file.name : 'Click to upload Amazon Associates report'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">CSV or TXT (tab-delimited)</p>
            </div>
            <input
              id="report-file"
              type="file"
              className="hidden"
              accept=".csv,.txt"
              onChange={handleFileChange}
            />
          </label>
        </div>

        <Button onClick={importReport} disabled={!file || isImporting} className="w-full">
          {isImporting ? 'Importing...' : 'Import Report'}
        </Button>
      </CardContent>
    </Card>
  );
};
