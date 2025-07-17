import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  Wrench,
  ExternalLink,
  Github,
  Search,
  Calendar
} from 'lucide-react';

interface AITool {
  id: string;
  title: string;
  description: string;
  category: string;
  image_url: string | null;
  link: string | null;
  github_link: string | null;
  features: string[] | null;
  pricing: string | null;
  complexity: string | null;
  status: string | null;
  tags: string[] | null;
  metrics: any;
  created_at: string | null;
  updated_at: string | null;
}

const AI_CATEGORIES = [
  'Natural Language Processing',
  'Computer Vision',
  'Machine Learning',
  'Data Analysis',
  'Automation',
  'Content Generation',
  'Voice & Audio',
  'Image Processing',
  'Code Generation',
  'Productivity',
  'Other'
];

const COMPLEXITY_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const PRICING_OPTIONS = ['Free', 'Freemium', 'Paid', 'Open Source', 'Enterprise'];
const STATUS_OPTIONS = ['Active', 'Beta', 'Coming Soon', 'Deprecated'];

export const AIToolsManager: React.FC = () => {
  const [tools, setTools] = useState<AITool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<AITool | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState<Partial<AITool>>({
    title: '',
    description: '',
    category: '',
    image_url: '',
    link: '',
    github_link: '',
    features: [],
    pricing: 'Free',
    complexity: 'Intermediate',
    status: 'Active',
    tags: [],
    metrics: {}
  });

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_tools')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTools(data || []);
    } catch (error) {
      console.error('Error loading AI tools:', error);
      toast({
        variant: "destructive",
        title: "Error loading AI tools",
        description: "Could not load AI tools. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof AITool, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayChange = (value: string, field: 'features' | 'tags') => {
    const items = value.split(',').map(item => item.trim()).filter(item => item);
    setFormData(prev => ({ ...prev, [field]: items }));
  };

  const generateContent = async () => {
    if (!formData.title) {
      toast({
        variant: "destructive",
        title: "Title required",
        description: "Please enter a tool title before generating content.",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const prompt = `Generate comprehensive description for AI tool: ${formData.title}. Include features, use cases, and technical details.`;

      const { data, error } = await supabase.functions
        .invoke('ai-content-generator', {
          body: { 
            type: 'ai-tool', 
            prompt,
            context: formData.category ? `Category: ${formData.category}` : undefined
          }
        });

      if (error) throw error;

      if (data.success) {
        const generated = data.data;
        
        setFormData(prev => ({
          ...prev,
          title: generated.title || prev.title,
          description: generated.description || prev.description,
          features: generated.features || prev.features,
          pricing: generated.pricing || prev.pricing,
          complexity: generated.complexity || prev.complexity,
          category: generated.category || prev.category,
          tags: generated.tags || prev.tags
        }));

        toast({
          title: "Content generated successfully",
          description: "AI has generated tool content for you.",
        });
      }
    } catch (error) {
      console.error('Error generating content:', error);
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: "Could not generate content. Please try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const saveTool = async () => {
    try {
      if (!formData.title || !formData.description || !formData.category) {
        toast({
          variant: "destructive",
          title: "Missing required fields",
          description: "Please fill in title, description, and category.",
        });
        return;
      }

      const toolData = {
        title: formData.title!,
        description: formData.description!,
        category: formData.category!,
        image_url: formData.image_url || null,
        link: formData.link || null,
        github_link: formData.github_link || null,
        features: formData.features || null,
        pricing: formData.pricing || 'Free',
        complexity: formData.complexity || 'Intermediate',
        status: formData.status || 'Active',
        tags: formData.tags || null,
        metrics: formData.metrics || null,
        updated_at: new Date().toISOString()
      };

      if (selectedTool) {
        // Update existing tool
        const { error } = await supabase
          .from('ai_tools')
          .update(toolData)
          .eq('id', selectedTool.id);

        if (error) throw error;
        
        toast({
          title: "AI tool updated",
          description: "Your AI tool has been updated successfully.",
        });
      } else {
        // Create new tool
        const { error } = await supabase
          .from('ai_tools')
          .insert([toolData]);

        if (error) throw error;
        
        toast({
          title: "AI tool created",
          description: "Your new AI tool has been created successfully.",
        });
      }

      setIsDialogOpen(false);
      setSelectedTool(null);
      setFormData({
        title: '',
        description: '',
        category: '',
        image_url: '',
        link: '',
        github_link: '',
        features: [],
        pricing: 'Free',
        complexity: 'Intermediate',
        status: 'Active',
        tags: [],
        metrics: {}
      });
      loadTools();
    } catch (error) {
      console.error('Error saving AI tool:', error);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Could not save AI tool. Please try again.",
      });
    }
  };

  const editTool = (tool: AITool) => {
    setSelectedTool(tool);
    setFormData(tool);
    setIsDialogOpen(true);
  };

  const deleteTool = async (id: string) => {
    if (!confirm('Are you sure you want to delete this AI tool?')) return;

    try {
      const { error } = await supabase
        .from('ai_tools')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "AI tool deleted",
        description: "The AI tool has been deleted successfully.",
      });
      
      loadTools();
    } catch (error) {
      console.error('Error deleting AI tool:', error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Could not delete AI tool. Please try again.",
      });
    }
  };

  const filteredTools = tools.filter(tool =>
    tool.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (tool.tags && tool.tags.some(tag => 
      tag.toLowerCase().includes(searchTerm.toLowerCase())
    ))
  );

  const openNewToolDialog = () => {
    setSelectedTool(null);
    setFormData({
      title: '',
      description: '',
      category: '',
      image_url: '',
      link: '',
      github_link: '',
      features: [],
      pricing: 'Free',
      complexity: 'Intermediate',
      status: 'Active',
      tags: [],
      metrics: {}
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">AI Tools Management</h2>
          <p className="text-muted-foreground">Manage your AI tools and resources</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewToolDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New AI Tool
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedTool ? 'Edit AI Tool' : 'Add New AI Tool'}
              </DialogTitle>
              <DialogDescription>
                {selectedTool ? 'Update the AI tool information.' : 'Add a new AI tool to your collection.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="title">Tool Name *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateContent}
                      disabled={isGenerating}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      {isGenerating ? 'Generating...' : 'Generate with AI'}
                    </Button>
                  </div>
                  <Input
                    id="title"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter AI tool name"
                  />
                </div>
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
                      {AI_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe the AI tool, its capabilities, and use cases"
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="features">Features (comma separated)</Label>
                <Textarea
                  id="features"
                  value={formData.features?.join(', ') || ''}
                  onChange={(e) => handleArrayChange(e.target.value, 'features')}
                  placeholder="Feature 1, Feature 2, Feature 3"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="link">Tool Website</Label>
                  <Input
                    id="link"
                    value={formData.link || ''}
                    onChange={(e) => handleInputChange('link', e.target.value)}
                    placeholder="https://tool-website.com"
                  />
                </div>
                <div>
                  <Label htmlFor="github-link">GitHub Repository</Label>
                  <Input
                    id="github-link"
                    value={formData.github_link || ''}
                    onChange={(e) => handleInputChange('github_link', e.target.value)}
                    placeholder="https://github.com/username/repo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="pricing">Pricing</Label>
                  <Select
                    value={formData.pricing || ''}
                    onValueChange={(value) => handleInputChange('pricing', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pricing" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICING_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="complexity">Complexity</Label>
                  <Select
                    value={formData.complexity || ''}
                    onValueChange={(value) => handleInputChange('complexity', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select complexity" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPLEXITY_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status || ''}
                    onValueChange={(value) => handleInputChange('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  value={formData.tags?.join(', ') || ''}
                  onChange={(e) => handleArrayChange(e.target.value, 'tags')}
                  placeholder="AI, ML, automation, etc."
                />
              </div>

              <div>
                <Label>Tool Image/Logo</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload an image or logo for the AI tool.
                </p>
                <FileUpload
                  onUpload={(url) => handleInputChange('image_url', url)}
                  currentImage={formData.image_url || undefined}
                  acceptedTypes={['image/*']}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={saveTool}>
                <Save className="h-4 w-4 mr-2" />
                {selectedTool ? 'Update' : 'Add'} Tool
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search AI tools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tools List */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading AI tools...</p>
            </CardContent>
          </Card>
        ) : filteredTools.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No AI tools found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? 'No tools match your search.' : 'Get started by adding your first AI tool.'}
              </p>
              {!searchTerm && (
                <Button onClick={openNewToolDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Tool
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredTools.map((tool) => (
            <Card key={tool.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold text-lg">{tool.title}</h3>
                      <Badge variant="outline">{tool.category}</Badge>
                      <Badge variant="secondary">{tool.pricing}</Badge>
                      <Badge variant="outline">{tool.complexity}</Badge>
                      <Badge 
                        variant={tool.status === 'Active' ? 'default' : 'secondary'}
                      >
                        {tool.status}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {tool.description}
                    </p>

                    {tool.features && tool.features.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-muted-foreground mb-1">Features:</p>
                        <div className="flex flex-wrap gap-1">
                          {tool.features.slice(0, 3).map((feature, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                          {tool.features.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{tool.features.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(tool.created_at || '').toLocaleDateString()}
                      </span>
                      {tool.link && (
                        <a 
                          href={tool.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Website
                        </a>
                      )}
                      {tool.github_link && (
                        <a 
                          href={tool.github_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center hover:text-foreground"
                        >
                          <Github className="h-3 w-3 mr-1" />
                          GitHub
                        </a>
                      )}
                    </div>

                    {tool.tags && tool.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tool.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {tool.link && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(tool.link!, '_blank')}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editTool(tool)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteTool(tool.id)}
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