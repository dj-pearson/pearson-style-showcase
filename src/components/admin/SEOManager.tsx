import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, FileText, Bot } from 'lucide-react';
import SitemapGenerator from '../SEO/SitemapGenerator';
import RobotsTxtGenerator from '../SEO/RobotsTxtGenerator';

const SEOManager = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">SEO Management</h2>
        <p className="text-muted-foreground">
          Manage your website's search engine optimization settings and tools.
        </p>
      </div>

      <Tabs defaultValue="sitemap" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sitemap" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Sitemap
          </TabsTrigger>
          <TabsTrigger value="robots" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Robots.txt
          </TabsTrigger>
          <TabsTrigger value="structured" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Structured Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sitemap">
          <SitemapGenerator />
        </TabsContent>

        <TabsContent value="robots">
          <RobotsTxtGenerator />
        </TabsContent>

        <TabsContent value="structured">
          <Card>
            <CardHeader>
              <CardTitle>Structured Data Status</CardTitle>
              <CardDescription>
                Your website automatically includes structured data markup for better search engine understanding.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-green-600">✓ Website Schema</h4>
                    <p className="text-sm text-muted-foreground">
                      Homepage includes website schema with search functionality
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-green-600">✓ Person Schema</h4>
                    <p className="text-sm text-muted-foreground">
                      About page includes detailed person schema markup
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-green-600">✓ Article Schema</h4>
                    <p className="text-sm text-muted-foreground">
                      All articles include proper article schema markup
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-green-600">✓ Project Schema</h4>
                    <p className="text-sm text-muted-foreground">
                      Projects include CreativeWork schema markup
                    </p>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200">Testing Your Structured Data</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Use Google's Rich Results Test tool to validate your structured data:
                  </p>
                  <a 
                    href="https://search.google.com/test/rich-results" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline text-sm"
                  >
                    https://search.google.com/test/rich-results
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SEOManager;