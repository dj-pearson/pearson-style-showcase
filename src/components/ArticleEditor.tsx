import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Separator } from '@/components/ui/separator';
import { 
  Type, 
  Code, 
  Eye, 
  Palette, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  Zap,
  Link,
  Image,
  List,
  Quote,
  Table
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface ArticleEditorProps {
  content: string;
  onChange: (content: string) => void;
  category?: string;
}

export const ArticleEditor: React.FC<ArticleEditorProps> = ({
  content,
  onChange,
  category
}) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [contentType, setContentType] = useState<'markdown' | 'html' | 'mixed'>('markdown');

  // Auto-detect content type
  React.useEffect(() => {
    const hasHTML = /<[a-z][\s\S]*>/i.test(content);
    const hasMarkdown = /[#*`[\]_~-]/.test(content) || content.includes('**') || content.includes('##') || content.includes('###') || content.includes('```');
    
    if (hasHTML && hasMarkdown) {
      setContentType('mixed');
    } else if (hasHTML) {
      setContentType('html');
    } else {
      setContentType('markdown');
    }
  }, [content]);

  const insertAtCursor = useCallback((insertion: string) => {
    const textarea = document.getElementById('content-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + insertion + content.substring(end);
    
    onChange(newContent);
    
    // Restore cursor position after content update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 0);
  }, [content, onChange]);

  const wrapSelection = useCallback((before: string, after: string = before) => {
    const textarea = document.getElementById('content-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newContent = content.substring(0, start) + before + selectedText + after + content.substring(end);
    
    onChange(newContent);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  }, [content, onChange]);

  const markdownActions = [
    {
      label: 'Heading 1',
      icon: Type,
      action: () => insertAtCursor('\n# '),
      shortcut: 'Ctrl+1'
    },
    {
      label: 'Heading 2',
      icon: Type,
      action: () => insertAtCursor('\n## '),
      shortcut: 'Ctrl+2'
    },
    {
      label: 'Bold',
      icon: Type,
      action: () => wrapSelection('**'),
      shortcut: 'Ctrl+B'
    },
    {
      label: 'Italic',
      icon: Type,
      action: () => wrapSelection('*'),
      shortcut: 'Ctrl+I'
    },
    {
      label: 'Code Block',
      icon: Code,
      action: () => insertAtCursor('\n```\n\n```\n'),
      shortcut: 'Ctrl+Shift+C'
    },
    {
      label: 'Link',
      icon: Link,
      action: () => insertAtCursor('[link text](https://example.com)'),
      shortcut: 'Ctrl+K'
    },
    {
      label: 'Image',
      icon: Image,
      action: () => insertAtCursor('![alt text](image-url)'),
      shortcut: 'Ctrl+Shift+I'
    },
    {
      label: 'List',
      icon: List,
      action: () => insertAtCursor('\n- '),
      shortcut: 'Ctrl+L'
    },
    {
      label: 'Quote',
      icon: Quote,
      action: () => insertAtCursor('\n> '),
      shortcut: 'Ctrl+Q'
    },
    {
      label: 'Table',
      icon: Table,
      action: () => insertAtCursor('\n| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n'),
      shortcut: 'Ctrl+T'
    }
  ];

  const customComponentActions = [
    {
      label: 'Primary Button',
      icon: Palette,
      action: () => insertAtCursor('[button:Click Me:https://example.com:primary]'),
      description: 'Creates a primary styled button'
    },
    {
      label: 'Secondary Button',
      icon: Palette,
      action: () => insertAtCursor('[button:Learn More:https://example.com:secondary]'),
      description: 'Creates a secondary styled button'
    },
    {
      label: 'Outline Button',
      icon: Palette,
      action: () => insertAtCursor('[button:Read More:https://example.com:outline]'),
      description: 'Creates an outline styled button'
    },
    {
      label: 'Info Alert',
      icon: Info,
      action: () => insertAtCursor('[alert:info:This is an informational message]'),
      description: 'Creates an info alert box'
    },
    {
      label: 'Warning Alert',
      icon: AlertCircle,
      action: () => insertAtCursor('[alert:warning:This is a warning message]'),
      description: 'Creates a warning alert box'
    },
    {
      label: 'Success Alert',
      icon: CheckCircle,
      action: () => insertAtCursor('[alert:success:This is a success message]'),
      description: 'Creates a success alert box'
    },
    {
      label: 'Error Alert',
      icon: AlertCircle,
      action: () => insertAtCursor('[alert:error:This is an error message]'),
      description: 'Creates an error alert box'
    },
    {
      label: 'Badge',
      icon: Zap,
      action: () => insertAtCursor('[badge:New Feature:default]'),
      description: 'Creates a badge/tag'
    }
  ];

  const htmlSnippets = [
    {
      label: 'HTML Button',
      action: () => insertAtCursor(`
<button class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4">
  Click Me
</button>`)
    },
    {
      label: 'Centered Content',
      action: () => insertAtCursor(`
<div style="text-align: center; margin: 2rem 0;">
  <!-- Your centered content here -->
</div>`)
    },
    {
      label: 'Call-to-Action Box',
      action: () => insertAtCursor(`
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 2rem; border-radius: 8px; text-align: center; margin: 2rem 0; color: white;">
  <h3 style="margin: 0 0 1rem 0; font-size: 1.5rem; font-weight: bold;">Ready to Get Started?</h3>
  <p style="margin: 0 0 1.5rem 0; opacity: 0.9;">Join thousands of developers already using our platform.</p>
  <a href="#" style="display: inline-block; background: white; color: #667eea; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; transition: transform 0.2s;">
    Get Started Today
  </a>
</div>`)
    }
  ];

  // Auto-add Build Desk content for Build Desk articles
  const addBuildDeskContent = useCallback(() => {
    const buildDeskHTML = `

<div style="text-align: center; margin: 2rem 0;">
  <a href="https://build-desk.com" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #FF5C00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; transition: background-color 0.3s ease; border: none; cursor: pointer;">
    Learn More About Build-Desk
  </a>
</div>

<style>
.build-desk-btn {
  display: inline-block;
  background-color: #FF5C00;
  color: white;
  padding: 12px 24px;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 16px;
  transition: background-color 0.3s ease;
  border: none;
  cursor: pointer;
}

.build-desk-btn:hover {
  background-color: #E64A00;
  color: white;
  text-decoration: none;
}
</style>`;

    if (!content.includes('Learn More About Build-Desk')) {
      onChange(content + buildDeskHTML);
    }
  }, [content, onChange]);

  return (
    <div className="space-y-4">
      {/* Content Type Detection */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Label>Content Type:</Label>
          <Badge variant={contentType === 'mixed' ? 'default' : 'secondary'}>
            {contentType === 'mixed' ? 'Markdown + HTML' : contentType.toUpperCase()}
          </Badge>
        </div>
        
        {(category === 'Build Desk' || content.includes('build-desk')) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addBuildDeskContent}
            disabled={content.includes('Learn More About Build-Desk')}
          >
            {content.includes('Learn More About Build-Desk') ? 'Build-Desk Link Added' : 'Add Build-Desk Link'}
          </Button>
        )}
      </div>

      {/* Editor Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'edit' | 'preview')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit" className="flex items-center space-x-2">
            <Type className="h-4 w-4" />
            <span>Edit</span>
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center space-x-2">
            <Eye className="h-4 w-4" />
            <span>Preview</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-4">
          {/* Toolbar */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Formatting Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Markdown Actions */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Markdown</Label>
                <div className="flex flex-wrap gap-1">
                  {markdownActions.map((action) => (
                    <Button
                      key={action.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={action.action}
                      title={`${action.label} (${action.shortcut})`}
                      className="text-xs"
                    >
                      <action.icon className="h-3 w-3 mr-1" />
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Custom Components */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Custom Components</Label>
                <div className="grid grid-cols-2 gap-2">
                  {customComponentActions.map((action) => (
                    <Button
                      key={action.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={action.action}
                      title={action.description}
                      className="text-xs justify-start"
                    >
                      <action.icon className="h-3 w-3 mr-1" />
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* HTML Snippets */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">HTML Snippets</Label>
                <div className="flex flex-wrap gap-1">
                  {htmlSnippets.map((snippet) => (
                    <Button
                      key={snippet.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={snippet.action}
                      className="text-xs"
                    >
                      {snippet.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content Editor */}
          <div>
            <Textarea
              id="content-editor"
              value={content}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Write your article content using Markdown, HTML, or both..."
              rows={20}
              className="font-mono text-sm resize-none"
            />
          </div>

          {/* Usage Guide */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Custom Component Syntax</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <div>
                <strong>Buttons:</strong> <code>[button:text:url:style]</code>
                <br />
                <span className="text-muted-foreground">Styles: primary, secondary, outline, destructive</span>
              </div>
              <div>
                <strong>Alerts:</strong> <code>[alert:type:message]</code>
                <br />
                <span className="text-muted-foreground">Types: info, warning, success, error</span>
              </div>
              <div>
                <strong>Badges:</strong> <code>[badge:text:variant]</code>
                <br />
                <span className="text-muted-foreground">Variants: default, secondary, destructive, outline</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownRenderer content={content} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ArticleEditor;
