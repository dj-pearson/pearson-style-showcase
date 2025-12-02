import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  validateStructuredData, 
  getGoogleRichResultsTestUrl, 
  getSchemaValidatorUrl,
  ValidationResult 
} from '@/lib/structuredDataValidator';
import { 
  CheckCircle2, XCircle, AlertTriangle, Lightbulb, 
  ExternalLink, Search, FileJson, Globe 
} from 'lucide-react';
import { toast } from 'sonner';

export const SEOValidationTool = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [urlInput, setUrlInput] = useState('https://danpearson.net');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const handleValidate = () => {
    try {
      const data = JSON.parse(jsonInput);
      const result = validateStructuredData(data);
      setValidationResult(result);
      
      if (result.isValid) {
        toast.success('Structured data is valid!');
      } else {
        toast.error(`Found ${result.errors.length} error(s)`);
      }
    } catch (error) {
      toast.error('Invalid JSON format');
      setValidationResult(null);
    }
  };

  const loadCurrentPageSchema = async () => {
    try {
      // Get all structured data scripts from the current page
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      if (scripts.length === 0) {
        toast.info('No structured data found on current page');
        return;
      }

      const schemas: unknown[] = [];
      scripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent || '');
          schemas.push(data);
        } catch {
          // Skip invalid JSON
        }
      });

      if (schemas.length > 0) {
        setJsonInput(JSON.stringify(schemas.length === 1 ? schemas[0] : schemas, null, 2));
        toast.success(`Loaded ${schemas.length} schema(s) from current page`);
      }
    } catch (error) {
      toast.error('Failed to load schema from page');
    }
  };

  const openGoogleTest = () => {
    window.open(getGoogleRichResultsTestUrl(urlInput), '_blank');
  };

  const openSchemaValidator = () => {
    window.open(getSchemaValidatorUrl(urlInput), '_blank');
  };

  return (
    <div className="space-y-6">
      {/* URL Testing Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            URL Testing
          </CardTitle>
          <CardDescription>
            Test your pages with Google and Schema.org validators
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Page URL</Label>
            <Input
              id="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://danpearson.net/news/your-article"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={openGoogleTest} variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Google Rich Results Test
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
            <Button onClick={openSchemaValidator} variant="outline">
              <FileJson className="h-4 w-4 mr-2" />
              Schema.org Validator
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* JSON-LD Validator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            JSON-LD Validator
          </CardTitle>
          <CardDescription>
            Paste your JSON-LD structured data to validate against Schema.org requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="json">JSON-LD Data</Label>
              <Button variant="ghost" size="sm" onClick={loadCurrentPageSchema}>
                Load from current page
              </Button>
            </div>
            <Textarea
              id="json"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder={`{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Your Article Title",
  "author": {
    "@type": "Person",
    "name": "Dan Pearson"
  },
  ...
}`}
              className="font-mono text-sm h-64"
            />
          </div>
          <Button onClick={handleValidate}>
            Validate JSON-LD
          </Button>
        </CardContent>
      </Card>

      {/* Validation Results */}
      {validationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {validationResult.isValid ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Valid Structured Data
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  Validation Failed
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Errors */}
            {validationResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Errors ({validationResult.errors.length})
                </h4>
                {validationResult.errors.map((error, i) => (
                  <Alert key={i} variant="destructive">
                    <AlertDescription>
                      <strong>{error.field}:</strong> {error.message}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {/* Warnings */}
            {validationResult.warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Warnings ({validationResult.warnings.length})
                </h4>
                {validationResult.warnings.map((warning, i) => (
                  <Alert key={i} className="border-yellow-500/50 bg-yellow-500/10">
                    <AlertDescription>
                      <strong>{warning.field}:</strong> {warning.message}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {validationResult.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-blue-500" />
                  Recommendations
                </h4>
                <ul className="space-y-1">
                  {validationResult.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline" className="mt-0.5">Tip</Badge>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Success message */}
            {validationResult.isValid && validationResult.errors.length === 0 && (
              <Alert className="border-green-500/50 bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  Your structured data is valid and ready for rich results!
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Supported Schema Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['Article', 'Product', 'FAQPage', 'HowTo', 'BreadcrumbList', 'Person', 'Organization', 'WebSite', 'Review'].map(type => (
              <Badge key={type} variant="secondary">{type}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
