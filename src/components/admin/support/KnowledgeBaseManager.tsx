import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BookOpen, Plus, Trash2, Edit, Eye, ThumbsUp, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';

interface KBArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  category: string | null;
  keywords: string[];
  published: boolean;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
}

export const KnowledgeBaseManager: React.FC = () => {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KBArticle | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    category: 'general',
    keywords: '',
    published: false
  });
  const { toast } = useToast();

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      const { data, error } = await supabase
        .from('kb_articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setArticles(data || []);
      setIsLoading(false);
    } catch (error) {
      logger.error('Failed to load KB articles:', error);
      setIsLoading(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleSave = async () => {
    try {
      if (!formData.title || !formData.content) {
        toast({
          title: 'Validation Error',
          description: 'Title and content are required.',
          variant: 'destructive'
        });
        return;
      }

      const slug = formData.slug || generateSlug(formData.title);
      const keywords = formData.keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      if (editingArticle) {
        // Update existing
        const { error } = await supabase
          .from('kb_articles')
          .update({
            title: formData.title,
            slug,
            content: formData.content,
            excerpt: formData.excerpt || null,
            category: formData.category,
            keywords,
            published: formData.published
          })
          .eq('id', editingArticle.id);

        if (error) throw error;

        toast({
          title: 'Article Updated',
          description: 'Knowledge base article has been updated.',
        });
      } else {
        // Create new
        const { error } = await supabase
          .from('kb_articles')
          .insert({
            title: formData.title,
            slug,
            content: formData.content,
            excerpt: formData.excerpt || null,
            category: formData.category,
            keywords,
            published: formData.published
          });

        if (error) throw error;

        toast({
          title: 'Article Created',
          description: 'New knowledge base article has been created.',
        });
      }

      setIsDialogOpen(false);
      setEditingArticle(null);
      setFormData({
        title: '',
        slug: '',
        content: '',
        excerpt: '',
        category: 'general',
        keywords: '',
        published: false
      });
      loadArticles();
    } catch (error: any) {
      logger.error('Failed to save KB article:', error);
      toast({
        title: 'Save Failed',
        description: error.message || 'Could not save the article.',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (article: KBArticle) => {
    setEditingArticle(article);
    setFormData({
      title: article.title,
      slug: article.slug,
      content: article.content,
      excerpt: article.excerpt || '',
      category: article.category || 'general',
      keywords: article.keywords.join(', '),
      published: article.published
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('kb_articles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Article Deleted',
        description: 'Knowledge base article has been removed.',
      });

      loadArticles();
    } catch (error) {
      logger.error('Failed to delete KB article:', error);
      toast({
        title: 'Delete Failed',
        description: 'Could not delete the article.',
        variant: 'destructive'
      });
    }
  };

  const togglePublished = async (id: string, currentlyPublished: boolean) => {
    try {
      const { error } = await supabase
        .from('kb_articles')
        .update({ published: !currentlyPublished })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: currentlyPublished ? 'Article Unpublished' : 'Article Published',
        description: `Article is now ${currentlyPublished ? 'hidden' : 'visible'} to users.`,
      });

      loadArticles();
    } catch (error) {
      logger.error('Failed to toggle published status:', error);
      toast({
        title: 'Update Failed',
        description: 'Could not update the article.',
        variant: 'destructive'
      });
    }
  };

  const getHelpfulnessRatio = (article: KBArticle) => {
    const total = article.helpful_count + article.not_helpful_count;
    if (total === 0) return 'No ratings';
    const percentage = ((article.helpful_count / total) * 100).toFixed(0);
    return `${percentage}% helpful (${total} votes)`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Knowledge Base Articles
            </CardTitle>
            <CardDescription>Self-service help articles for users</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingArticle(null);
                setFormData({
                  title: '',
                  slug: '',
                  content: '',
                  excerpt: '',
                  category: 'general',
                  keywords: '',
                  published: false
                });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                New Article
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingArticle ? 'Edit' : 'Create'} KB Article</DialogTitle>
                <DialogDescription>
                  Create helpful articles that users can find on their own
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    placeholder="e.g., How to reset your password"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Slug (URL)</label>
                  <Input
                    placeholder="Auto-generated from title"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave blank to auto-generate from title
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Excerpt (Summary)</label>
                  <Textarea
                    placeholder="Brief summary shown in search results..."
                    value={formData.excerpt}
                    onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                    rows={2}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Category</label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="getting_started">Getting Started</SelectItem>
                        <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
                        <SelectItem value="account">Account</SelectItem>
                        <SelectItem value="billing">Billing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Keywords (comma-separated)</label>
                    <Input
                      placeholder="password, reset, login"
                      value={formData.keywords}
                      onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Content (Markdown supported)</label>
                  <Textarea
                    placeholder="# Article Title

Write your help article content here. You can use Markdown formatting.

## Section Heading

- Bullet points
- Are supported

**Bold text** and *italic text* work too."
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={12}
                    className="mt-1 font-mono text-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.published}
                    onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
                  />
                  <label className="text-sm font-medium">Publish immediately</label>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {editingArticle ? 'Update' : 'Create'} Article
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No knowledge base articles yet</p>
            <p className="text-sm mt-1">Create your first help article</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{article.title}</h4>
                        {article.published ? (
                          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500">
                            Published
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Draft
                          </Badge>
                        )}
                        {article.category && (
                          <Badge variant="secondary" className="text-xs">
                            {article.category}
                          </Badge>
                        )}
                      </div>

                      {article.excerpt && (
                        <p className="text-sm text-muted-foreground mb-2">{article.excerpt}</p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {article.view_count} views
                        </div>
                        <div className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {getHelpfulnessRatio(article)}
                        </div>
                        {article.keywords.length > 0 && (
                          <div>
                            Keywords: {article.keywords.slice(0, 3).join(', ')}
                            {article.keywords.length > 3 && '...'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {article.published && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`/help/${article.slug}`, '_blank')}
                          title="View public page"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(article)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => togglePublished(article.id, article.published)}
                        title={article.published ? 'Unpublish' : 'Publish'}
                      >
                        {article.published ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4 opacity-50" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(article.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
