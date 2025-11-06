import { useState } from "react";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, FileText, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const AmazonReportImporter = () => {
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
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('Empty file');
    }

    // Amazon Associates reports typically have headers in first row
    const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
    
    // Find column indexes
    const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('shipped'));
    const asinIdx = headers.findIndex(h => h.includes('asin'));
    const quantityIdx = headers.findIndex(h => h.includes('quantity') || h.includes('items'));
    const revenueIdx = headers.findIndex(h => h.includes('revenue') || h.includes('price'));
    const commissionIdx = headers.findIndex(h => h.includes('commission') || h.includes('earnings'));

    if (dateIdx === -1 || asinIdx === -1) {
      throw new Error('Could not find required columns (Date, ASIN). Make sure you uploaded an Amazon Associates order report.');
    }

    const records: any[] = [];

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
      const revenue = revenueIdx !== -1 ? parseFloat(values[revenueIdx]?.replace(/[$,]/g, '') || '0') : 0;
      const commission = commissionIdx !== -1 ? parseFloat(values[commissionIdx]?.replace(/[$,]/g, '') || '0') : 0;

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

      // Group by date + ASIN and aggregate
      const statsMap = new Map<string, any>();
      
      for (const record of records) {
        const key = `${record.date}-${record.asin}`;
        
        if (!statsMap.has(key)) {
          // Try to find the article_id for this ASIN
          const { data: articleProduct } = await supabase
            .from('article_products')
            .select('article_id')
            .eq('asin', record.asin)
            .limit(1)
            .single();

          statsMap.set(key, {
            date: record.date,
            asin: record.asin,
            article_id: articleProduct?.article_id || null,
            orders: 0,
            revenue: 0,
            commission: 0,
          });
        }

        const stat = statsMap.get(key);
        stat.orders += record.quantity;
        stat.revenue += record.revenue;
        stat.commission += record.commission;
      }

      const stats = Array.from(statsMap.values());

      // Upsert stats
      let imported = 0;
      let updated = 0;

      for (const stat of stats) {
        const { data: existing } = await supabase
          .from('amazon_affiliate_stats')
          .select('id, orders, revenue, commission')
          .eq('date', stat.date)
          .eq('asin', stat.asin)
          .maybeSingle();

        if (existing) {
          // Update existing record
          await supabase
            .from('amazon_affiliate_stats')
            .update({
              orders: stat.orders,
              revenue: stat.revenue,
              commission: stat.commission,
            })
            .eq('id', existing.id);
          updated++;
        } else {
          // Insert new record
          await supabase
            .from('amazon_affiliate_stats')
            .insert(stat);
          imported++;
        }
      }

      toast.success(`Import complete! ${imported} new records, ${updated} updated`);
      setFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('report-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error: any) {
      logger.error('Import error:', error);
      toast.error(`Import failed: ${error.message}`);
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
                <li>Go to <a href="https://affiliate-program.amazon.com/home/reports" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Amazon Associates Reports</a></li>
                <li>Select "Orders Report" → Choose date range</li>
                <li>Download as Tab-delimited (TXT) or CSV</li>
                <li>Upload the file below</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                The importer will automatically match ASINs to your articles and update conversion data.
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
              <p className="text-xs text-muted-foreground mt-1">
                CSV or TXT (tab-delimited)
              </p>
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

        <Button 
          onClick={importReport} 
          disabled={!file || isImporting}
          className="w-full"
        >
          {isImporting ? 'Importing...' : 'Import Report'}
        </Button>
      </CardContent>
    </Card>
  );
};