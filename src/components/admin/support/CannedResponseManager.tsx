import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { MessageSquare, Plus, Trash2, Edit, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';

interface CannedResponse {
  id: string;
  title: string;
  shortcut: string | null;
  content: string;
  category: string | null;
  usage_count: number;
  created_at: string;
}

export const CannedResponseManager: React.FC = () => {
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResponse, setEditingResponse] = useState<CannedResponse | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    shortcut: '',
    content: '',
    category: 'general'
  });
  const { toast } = useToast();

  useEffect(() => {
    loadResponses();
  }, []);

  const loadResponses = async () => {
    try {
      const { data, error } = await supabase
        .from('canned_responses')
        .select('*')
        .order('usage_count', { ascending: false });

      if (error) throw error;

      setResponses(data || []);
      setIsLoading(false);
    } catch (error) {
      logger.error('Failed to load canned responses:', error);
      setIsLoading(false);
    }
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

      if (editingResponse) {
        // Update existing
        const { error } = await supabase
          .from('canned_responses')
          .update({
            title: formData.title,
            shortcut: formData.shortcut || null,
            content: formData.content,
            category: formData.category
          })
          .eq('id', editingResponse.id);

        if (error) throw error;

        toast({
          title: 'Response Updated',
          description: 'Canned response has been updated successfully.',
        });
      } else {
        // Create new
        const { error } = await supabase
          .from('canned_responses')
          .insert({
            title: formData.title,
            shortcut: formData.shortcut || null,
            content: formData.content,
            category: formData.category
          });

        if (error) throw error;

        toast({
          title: 'Response Created',
          description: 'New canned response has been created.',
        });
      }

      setIsDialogOpen(false);
      setEditingResponse(null);
      setFormData({ title: '', shortcut: '', content: '', category: 'general' });
      loadResponses();
    } catch (error) {
      logger.error('Failed to save canned response:', error);
      toast({
        title: 'Save Failed',
        description: 'Could not save the canned response.',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (response: CannedResponse) => {
    setEditingResponse(response);
    setFormData({
      title: response.title,
      shortcut: response.shortcut || '',
      content: response.content,
      category: response.category || 'general'
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this canned response?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('canned_responses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Response Deleted',
        description: 'Canned response has been removed.',
      });

      loadResponses();
    } catch (error) {
      logger.error('Failed to delete canned response:', error);
      toast({
        title: 'Delete Failed',
        description: 'Could not delete the canned response.',
        variant: 'destructive'
      });
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: 'Copied!',
      description: 'Response copied to clipboard.',
    });
  };

  const getCategoryBadge = (category: string | null) => {
    const colors: Record<string, string> = {
      general: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      bug: 'bg-red-500/10 text-red-500 border-red-500/20',
      feature_request: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      question: 'bg-green-500/10 text-green-500 border-green-500/20'
    };

    return (
      <Badge variant="outline" className={`text-xs ${colors[category || 'general']}`}>
        {category || 'general'}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Canned Responses
            </CardTitle>
            <CardDescription>Quick reply templates for common support requests</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingResponse(null);
                setFormData({ title: '', shortcut: '', content: '', category: 'general' });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                New Response
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingResponse ? 'Edit' : 'Create'} Canned Response</DialogTitle>
                <DialogDescription>
                  Save time with pre-written responses for common support scenarios
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    placeholder="e.g., Welcome Message"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Shortcut (optional)</label>
                    <Input
                      placeholder="e.g., /welcome"
                      value={formData.shortcut}
                      onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Type this to quickly insert</p>
                  </div>

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
                        <SelectItem value="bug">Bug Report</SelectItem>
                        <SelectItem value="feature_request">Feature Request</SelectItem>
                        <SelectItem value="question">Question</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Response Content</label>
                  <Textarea
                    placeholder="Enter your response template..."
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={8}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This text will be inserted when you use this template
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {editingResponse ? 'Update' : 'Create'} Response
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
        ) : responses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No canned responses yet</p>
            <p className="text-sm mt-1">Create your first quick reply template</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {responses.map((response) => (
                <div
                  key={response.id}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{response.title}</h4>
                        {getCategoryBadge(response.category)}
                        {response.shortcut && (
                          <Badge variant="outline" className="text-xs font-mono">
                            {response.shortcut}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          Used {response.usage_count} times
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                        {response.content}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(response.content)}
                        title="Copy to clipboard"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(response)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(response.id)}
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
