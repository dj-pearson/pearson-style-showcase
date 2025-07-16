import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Download, Copy, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const RobotsTxtGenerator = () => {
  const [robotsContent, setRobotsContent] = useState(`User-agent: *
Allow: /

# Sitemap
Sitemap: https://danpearson.net/sitemap.xml

# Disallow admin areas
User-agent: *
Disallow: /admin/

# Allow social media crawlers
User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: LinkedInBot
Allow: /`);
  
  const { toast } = useToast();

  const downloadRobotsTxt = () => {
    const blob = new Blob([robotsContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'robots.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Robots.txt Downloaded",
      description: "Upload this file to your website's root directory.",
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(robotsContent);
    toast({
      title: "Copied to Clipboard",
      description: "Robots.txt content copied to clipboard.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Robots.txt Generator
        </CardTitle>
        <CardDescription>
          Configure how search engine crawlers should interact with your website.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={robotsContent}
          onChange={(e) => setRobotsContent(e.target.value)}
          rows={12}
          className="font-mono text-sm"
          placeholder="Enter robots.txt content..."
        />
        
        <div className="flex gap-2">
          <Button onClick={downloadRobotsTxt} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
          <Button variant="outline" onClick={copyToClipboard} className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Copy
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Instructions:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Download and upload robots.txt to your website's root directory</li>
            <li>Update the sitemap URL to match your actual domain</li>
            <li>The file blocks crawlers from admin areas while allowing all other content</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default RobotsTxtGenerator;