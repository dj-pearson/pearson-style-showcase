import React, { useState, useEffect, useCallback } from 'react';
import { logger } from "@/lib/logger";
import { validateTextInput, validateUrl, validateSlug, sanitizeStringArray, sanitizeHtml } from '@/lib/security';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileUpload } from './FileUpload';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Sparkles, 
  Save, 
  X,
  FileText,
  Image as ImageIcon,
  Search,
  Calendar,
  Send
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ArticleEditor from '../ArticleEditor';

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string | null;
  category: string;
  author: string | null;
  image_url: string | null;
  published: boolean | null;
  featured: boolean | null;
  view_count: number | null;
  read_time: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  target_keyword: string | null;
  tags: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

export const ArticleManager: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingWebhooks, setSendingWebhooks] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState<Partial<Article>>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    category: '',
    author: 'Dan Pearson',
    image_url: '',
    published: false,
    featured: false,
    read_time: '5 min read',
    seo_title: '',
    seo_description: '',
    seo_keywords: [],
    target_keyword: '',
    tags: []
  });

  const loadArticles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      logger.error('Error loading articles:', error);
      toast({
        variant: "destructive",
        title: "Error loading articles",
        description: "Could not load articles. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('article_categories')
        .select('name')
        .order('name');

      if (error) throw error;
      setCategories(data?.map(cat => cat.name) || []);
    } catch (error) {
      logger.error('Error loading categories:', error);
    }
  }, []);

  useEffect(() => {
    loadArticles();
    loadCategories();
  }, [loadArticles, loadCategories]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleInputChange = (field: keyof Article, value: string | boolean | string[] | null) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-generate slug from title
      if (field === 'title' && typeof value === 'string' && value) {
        updated.slug = generateSlug(value);
      }
      
      return updated;
    });
  };

  const handleTagsChange = (value: string, field: 'tags' | 'seo_keywords') => {
    const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
    setFormData(prev => ({ ...prev, [field]: tags }));
  };

  const generateContent = async (type: 'full' | 'seo') => {
    if (!formData.title && type === 'full') {
      toast({
        variant: "destructive",
        title: "Title required",
        description: "Please enter a title before generating content.",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const prompt = type === 'full' 
        ? `Write a comprehensive article about: ${formData.title}. ${formData.excerpt ? `Context: ${formData.excerpt}` : ''}`
        : `Generate SEO metadata for an article titled: ${formData.title}. ${formData.content ? `Content preview: ${formData.content?.substring(0, 500)}...` : ''}`;

      const { data, error } = await supabase.functions
        .invoke('ai-content-generator', {
          body: { 
            type: type === 'full' ? 'article' : 'seo', 
            prompt,
            context: formData.category ? `Category: ${formData.category}` : undefined
          }
        });

      if (error) throw error;

      if (data.success) {
        const generated = data.data;
        
        if (type === 'full') {
          setFormData(prev => ({
            ...prev,
            title: generated.title || prev.title,
            content: generated.content || prev.content,
            excerpt: generated.excerpt || prev.excerpt,
            tags: generated.tags || prev.tags,
            seo_title: generated.seoTitle || prev.seo_title,
            seo_description: generated.seoDescription || prev.seo_description,
            target_keyword: generated.targetKeyword || prev.target_keyword,
            slug: generateSlug(generated.title || prev.title || '')
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            seo_title: generated.seoTitle || prev.seo_title,
            seo_description: generated.seoDescription || prev.seo_description,
            target_keyword: generated.targetKeyword || prev.target_keyword,
            seo_keywords: generated.seoKeywords || prev.seo_keywords
          }));
        }

        toast({
          title: "Content generated successfully",
          description: `AI has generated ${type === 'full' ? 'article content' : 'SEO metadata'} for you.`,
        });
      }
    } catch (error) {
      logger.error('Error generating content:', error);
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: "Could not generate content. Please try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const saveArticle = async () => {
    try {
      if (!formData.title || !formData.slug || !formData.excerpt || !formData.category) {
        toast({
          variant: "destructive",
          title: "Missing required fields",
          description: "Please fill in title, excerpt, and category.",
        });
        return;
      }

      // Validate and sanitize inputs (SECURITY: Prevent injection attacks)
      const sanitizedTitle = validateTextInput(formData.title, 255);
      const sanitizedSlug = validateSlug(formData.slug);
      const sanitizedExcerpt = validateTextInput(formData.excerpt, 500);
      const sanitizedCategory = validateTextInput(formData.category, 100);
      const sanitizedAuthor = formData.author ? validateTextInput(formData.author, 100) : null;

      if (!sanitizedTitle || !sanitizedSlug || !sanitizedExcerpt || !sanitizedCategory) {
        toast({
          variant: "destructive",
          title: "Invalid input",
          description: "Please check your input for invalid characters or excessive length.",
        });
        return;
      }

      // Sanitize optional text fields
      const sanitizedSeoTitle = formData.seo_title ? validateTextInput(formData.seo_title, 255) : null;
      const sanitizedSeoDescription = formData.seo_description ? validateTextInput(formData.seo_description, 500) : null;
      const sanitizedTargetKeyword = formData.target_keyword ? validateTextInput(formData.target_keyword, 100) : null;
      const sanitizedReadTime = formData.read_time ? validateTextInput(formData.read_time, 50) : null;

      // Validate URL if provided
      const sanitizedImageUrl = formData.image_url ? validateUrl(formData.image_url) : null;
      if (formData.image_url && !sanitizedImageUrl) {
        toast({
          variant: "destructive",
          title: "Invalid URL",
          description: "Please provide a valid image URL.",
        });
        return;
      }

      // Sanitize arrays
      const sanitizedTags = formData.tags ? sanitizeStringArray(formData.tags, 50) : null;
      const sanitizedSeoKeywords = formData.seo_keywords ? sanitizeStringArray(formData.seo_keywords, 100) : null;

      // Check if this is a Build Desk article and add the HTML if needed
      let content = formData.content || '';
      const isBuildDeskArticle = formData.category === 'Build Desk' || sanitizedSlug === 'build-desk' || sanitizedSlug?.includes('build-desk');
      
      if (isBuildDeskArticle && content) {
        const buildDeskHtml = `

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

.build-desk-btn:focus {
  outline: 2px solid #E64A00;
  outline-offset: 2px;
}
</style>`;

        // Only add the HTML if it's not already present
        if (!content.includes('Learn More About Build-Desk')) {
          content = content + buildDeskHtml;
        }
      }

      // Sanitize HTML content while preserving allowed tags
      const sanitizedContent = content ? sanitizeHtml(content, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'img', 'div', 'span',
          'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'button', 'style'
        ],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'style', 'target', 'rel'],
        ALLOW_DATA_ATTR: false,
      }) : '';

      const articleData = {
        title: sanitizedTitle,
        slug: sanitizedSlug,
        excerpt: sanitizedExcerpt,
        content: sanitizedContent,
        category: sanitizedCategory,
        author: sanitizedAuthor || 'Dan Pearson',
        image_url: sanitizedImageUrl,
        published: formData.published || false,
        featured: formData.featured || false,
        read_time: sanitizedReadTime || '5 min read',
        seo_title: sanitizedSeoTitle,
        seo_description: sanitizedSeoDescription,
        seo_keywords: sanitizedSeoKeywords,
        target_keyword: sanitizedTargetKeyword,
        tags: sanitizedTags,
        updated_at: new Date().toISOString()
      };

      if (selectedArticle) {
        // Update existing article
        const { error } = await supabase
          .from('articles')
          .update(articleData)
          .eq('id', selectedArticle.id);

        if (error) throw error;

        // If article was just published, send to webhook
        const wasPublished = !selectedArticle.published && articleData.published;
        if (wasPublished) {
          toast({
            title: "Article updated and publishing",
            description: "Sending article to webhook for social media distribution...",
          });
          // Send to webhook in background
          sendToWebhook(selectedArticle.id);
        } else {
          toast({
            title: "Article updated",
            description: "Your article has been updated successfully.",
          });
        }
      } else {
        // Create new article
        const { data: newArticle, error } = await supabase
          .from('articles')
          .insert([articleData])
          .select()
          .single();

        if (error) throw error;

        // If new article is published, send to webhook
        if (articleData.published && newArticle) {
          toast({
            title: "Article created and publishing",
            description: "Sending article to webhook for social media distribution...",
          });
          // Send to webhook in background
          sendToWebhook(newArticle.id);
        } else {
          toast({
            title: "Article created",
            description: "Your new article has been created successfully.",
          });
        }
      }

      setIsDialogOpen(false);
      setSelectedArticle(null);
      setFormData({
        title: '',
        slug: '',
        excerpt: '',
        content: '',
        category: '',
        author: 'Dan Pearson',
        image_url: '',
        published: false,
        featured: false,
        read_time: '5 min read',
        seo_title: '',
        seo_description: '',
        seo_keywords: [],
        target_keyword: '',
        tags: []
      });
      loadArticles();
    } catch (error) {
      logger.error('Error saving article:', error);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Could not save article. Please try again.",
      });
    }
  };

  const sendToWebhook = async (articleId: string) => {
    setSendingWebhooks(prev => new Set(prev).add(articleId));
    try {
      const { data, error } = await supabase.functions.invoke('send-article-webhook', {
        body: { articleId }
      });

      if (error) throw error;

      toast({
        title: "Webhook sent",
        description: "Article has been sent to Make.com webhook successfully.",
      });
    } catch (error) {
      logger.error('Error sending webhook:', error);
      toast({
        variant: "destructive",
        title: "Webhook failed",
        description: "Could not send article to webhook. Please check webhook settings.",
      });
    } finally {
      setSendingWebhooks(prev => {
        const newSet = new Set(prev);
        newSet.delete(articleId);
        return newSet;
      });
    }
  };

  const editArticle = (article: Article) => {
    setSelectedArticle(article);
    setFormData(article);
    setIsDialogOpen(true);
  };

  const deleteArticle = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;

    try {
      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Article deleted",
        description: "The article has been deleted successfully.",
      });
      
      loadArticles();
    } catch (error) {
      logger.error('Error deleting article:', error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Could not delete article. Please try again.",
      });
    }
  };

  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (article.author && article.author.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openNewArticleDialog = () => {
    setSelectedArticle(null);
    setFormData({
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      category: '',
      author: 'Dan Pearson',
      image_url: '',
      published: false,
      featured: false,
      read_time: '5 min read',
      seo_title: '',
      seo_description: '',
      seo_keywords: [],
      target_keyword: '',
      tags: []
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Article Management</h2>
          <p className="text-muted-foreground">Create and manage your blog articles</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewArticleDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Article
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedArticle ? 'Edit Article' : 'Create New Article'}
              </DialogTitle>
              <DialogDescription>
                {selectedArticle ? 'Update your article content and settings.' : 'Create a new article with AI assistance.'}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="seo">SEO</TabsTrigger>
                <TabsTrigger value="media">Media</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title || ''}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      placeholder="Enter article title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      value={formData.slug || ''}
                      onChange={(e) => handleInputChange('slug', e.target.value)}
                      placeholder="auto-generated-from-title"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="excerpt">Excerpt/Summary *</Label>
                  <Textarea
                    id="excerpt"
                    value={formData.excerpt || ''}
                    onChange={(e) => handleInputChange('excerpt', e.target.value)}
                    placeholder="Brief description of the article"
                    rows={3}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="content">Content (Markdown/HTML)</Label>
                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => generateContent('full')}
                        disabled={isGenerating}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        {isGenerating ? 'Generating...' : 'Generate with AI'}
                      </Button>
                    </div>
                  </div>
                  <ArticleEditor
                    content={formData.content || ''}
                    onChange={(content) => handleInputChange('content', content)}
                    category={formData.category}
                  />
                </div>
              </TabsContent>

              <TabsContent value="seo" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">SEO Optimization</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => generateContent('seo')}
                    disabled={isGenerating}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isGenerating ? 'Generating...' : 'Generate SEO'}
                  </Button>
                </div>

                <div>
                  <Label htmlFor="seo-title">SEO Title</Label>
                  <Input
                    id="seo-title"
                    value={formData.seo_title || ''}
                    onChange={(e) => handleInputChange('seo_title', e.target.value)}
                    placeholder="SEO optimized title"
                  />
                </div>

                <div>
                  <Label htmlFor="seo-description">Meta Description</Label>
                  <Textarea
                    id="seo-description"
                    value={formData.seo_description || ''}
                    onChange={(e) => handleInputChange('seo_description', e.target.value)}
                    placeholder="Brief description for search engines"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="target-keyword">Target Keyword</Label>
                  <Input
                    id="target-keyword"
                    value={formData.target_keyword || ''}
                    onChange={(e) => handleInputChange('target_keyword', e.target.value)}
                    placeholder="Primary keyword to target"
                  />
                </div>

                <div>
                  <Label htmlFor="seo-keywords">SEO Keywords (comma separated)</Label>
                  <Input
                    id="seo-keywords"
                    value={formData.seo_keywords?.join(', ') || ''}
                    onChange={(e) => handleTagsChange(e.target.value, 'seo_keywords')}
                    placeholder="keyword1, keyword2, keyword3"
                  />
                </div>

                <div>
                  <Label htmlFor="tags">Tags (comma separated)</Label>
                  <Input
                    id="tags"
                    value={formData.tags?.join(', ') || ''}
                    onChange={(e) => handleTagsChange(e.target.value, 'tags')}
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
              </TabsContent>

              <TabsContent value="media" className="space-y-4">
                <div>
                  <Label>Featured Image</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload a featured image for your article. This will be used in article cards and for SEO.
                  </p>
                  <FileUpload
                    onUpload={(url) => handleInputChange('image_url', url)}
                    currentImage={formData.image_url || undefined}
                    acceptedTypes={['image/*']}
                  />
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={formData.category || ''}
                      onValueChange={(value) => handleInputChange('category', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="author">Author</Label>
                    <Input
                      id="author"
                      value={formData.author || ''}
                      onChange={(e) => handleInputChange('author', e.target.value)}
                      placeholder="Article author"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="read-time">Read Time</Label>
                  <Input
                    id="read-time"
                    value={formData.read_time || ''}
                    onChange={(e) => handleInputChange('read_time', e.target.value)}
                    placeholder="5 min read"
                  />
                </div>

                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="published"
                      checked={formData.published || false}
                      onCheckedChange={(checked) => handleInputChange('published', checked)}
                    />
                    <Label htmlFor="published">Published</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="featured"
                      checked={formData.featured || false}
                      onCheckedChange={(checked) => handleInputChange('featured', checked)}
                    />
                    <Label htmlFor="featured">Featured</Label>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={saveArticle}>
                <Save className="h-4 w-4 mr-2" />
                {selectedArticle ? 'Update' : 'Create'} Article
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Articles List */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading articles...</p>
            </CardContent>
          </Card>
        ) : filteredArticles.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No articles found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? 'No articles match your search.' : 'Get started by creating your first article.'}
              </p>
              {!searchTerm && (
                <Button onClick={openNewArticleDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Article
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredArticles.map((article) => (
            <Card key={article.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold text-lg">{article.title}</h3>
                      {article.featured && <Badge variant="secondary">Featured</Badge>}
                      {article.published ? (
                        <Badge variant="default">Published</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">{article.excerpt}</p>
                    
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(article.created_at || '').toLocaleDateString()}
                      </span>
                      <span>Category: {article.category}</span>
                      <span>Author: {article.author}</span>
                      <span>Views: {article.view_count || 0}</span>
                      {article.read_time && <span>{article.read_time}</span>}
                    </div>

                    {article.tags && article.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {article.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/news/${article.slug}`, '_blank')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendToWebhook(article.id)}
                      disabled={sendingWebhooks.has(article.id)}
                      title="Send to webhook"
                    >
                      {sendingWebhooks.has(article.id) ? (
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editArticle(article)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteArticle(article.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};