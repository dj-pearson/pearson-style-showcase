import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  Database,
  ExternalLink,
  Github,
  Search,
  Calendar,
  ChevronUp,
  ChevronDown,
  GripVertical
} from 'lucide-react';

interface Project {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  github_link: string | null;
  live_link: string | null;
  tags: string[] | null;
  status: string | null;
  featured: boolean | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

const PROJECT_STATUSES = ['Active', 'In Development', 'On Hold', 'Completed', 'Archived'];

export const ProjectManager: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState<Partial<Project>>({
    title: '',
    description: '',
    image_url: '',
    github_link: '',
    live_link: '',
    tags: [],
    status: 'Active',
    featured: false
  });

  const loadProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        variant: "destructive",
        title: "Error loading projects",
        description: "Could not load projects. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleInputChange = (field: keyof Project, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTagsChange = (value: string) => {
    const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
    setFormData(prev => ({ ...prev, tags }));
  };

  const generateContent = async () => {
    if (!formData.title) {
      toast({
        variant: "destructive",
        title: "Title required",
        description: "Please enter a project title before generating content.",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const prompt = `Generate comprehensive project description for: ${formData.title}. Include technical details, features, and technologies used.`;

      const { data, error } = await supabase.functions
        .invoke('ai-content-generator', {
          body: { 
            type: 'project', 
            prompt,
            context: formData.description ? `Current description: ${formData.description}` : undefined
          }
        });

      if (error) throw error;

      if (data.success) {
        const generated = data.data;
        
        setFormData(prev => ({
          ...prev,
          title: generated.title || prev.title,
          description: generated.description || prev.description,
          tags: generated.tags || prev.tags,
          status: generated.status || prev.status
        }));

        toast({
          title: "Content generated successfully",
          description: "AI has generated project content for you.",
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

  const saveProject = async () => {
    try {
      if (!formData.title || !formData.description) {
        toast({
          variant: "destructive",
          title: "Missing required fields",
          description: "Please fill in title and description.",
        });
        return;
      }

      const projectData = {
        title: formData.title!,
        description: formData.description!,
        image_url: formData.image_url || null,
        github_link: formData.github_link || null,
        live_link: formData.live_link || null,
        tags: formData.tags || null,
        status: formData.status || 'Active',
        featured: formData.featured || false,
        sort_order: formData.sort_order || 0,
        updated_at: new Date().toISOString()
      };

      if (selectedProject) {
        // Update existing project
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', selectedProject.id);

        if (error) throw error;
        
        toast({
          title: "Project updated",
          description: "Your project has been updated successfully.",
        });
      } else {
        // Create new project - get max sort_order and add 1
        const { data: maxSortOrder } = await supabase
          .from('projects')
          .select('sort_order')
          .order('sort_order', { ascending: false })
          .limit(1)
          .single();

        projectData.sort_order = (maxSortOrder?.sort_order || 0) + 1;

        const { error } = await supabase
          .from('projects')
          .insert([projectData]);

        if (error) throw error;
        
        toast({
          title: "Project created",
          description: "Your new project has been created successfully.",
        });
      }

      setIsDialogOpen(false);
      setSelectedProject(null);
      setFormData({
        title: '',
        description: '',
        image_url: '',
        github_link: '',
        live_link: '',
        tags: [],
        status: 'Active',
        featured: false
      });
      loadProjects();
    } catch (error) {
      console.error('Error saving project:', error);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Could not save project. Please try again.",
      });
    }
  };

  const editProject = (project: Project) => {
    setSelectedProject(project);
    setFormData(project);
    setIsDialogOpen(true);
  };

  const deleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Project deleted",
        description: "The project has been deleted successfully.",
      });
      
      loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Could not delete project. Please try again.",
      });
    }
  };

  const filteredProjects = projects.filter(project =>
    project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.tags && project.tags.some(tag => 
      tag.toLowerCase().includes(searchTerm.toLowerCase())
    ))
  );

  const moveProject = async (projectId: string, direction: 'up' | 'down') => {
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) return;

    const targetIndex = direction === 'up' ? projectIndex - 1 : projectIndex + 1;
    if (targetIndex < 0 || targetIndex >= projects.length) return;

    const project = projects[projectIndex];
    const targetProject = projects[targetIndex];

    try {
      // Swap sort_order values
      await supabase
        .from('projects')
        .update({ sort_order: targetProject.sort_order })
        .eq('id', project.id);

      await supabase
        .from('projects')
        .update({ sort_order: project.sort_order })
        .eq('id', targetProject.id);

      toast({
        title: "Project reordered",
        description: `Project moved ${direction}.`,
      });

      loadProjects();
    } catch (error) {
      console.error('Error reordering project:', error);
      toast({
        variant: "destructive",
        title: "Reorder failed",
        description: "Could not reorder project. Please try again.",
      });
    }
  };

  const openNewProjectDialog = () => {
    setSelectedProject(null);
    setFormData({
      title: '',
      description: '',
      image_url: '',
      github_link: '',
      live_link: '',
      tags: [],
      status: 'Active',
      featured: false
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Project Management</h2>
          <p className="text-muted-foreground">Manage your portfolio projects</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewProjectDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedProject ? 'Edit Project' : 'Create New Project'}
              </DialogTitle>
              <DialogDescription>
                {selectedProject ? 'Update your project details.' : 'Add a new project to your portfolio.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="title">Project Title *</Label>
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
                  placeholder="Enter project title"
                />
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe your project, its features, and technologies used"
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="github-link">GitHub Link</Label>
                  <Input
                    id="github-link"
                    value={formData.github_link || ''}
                    onChange={(e) => handleInputChange('github_link', e.target.value)}
                    placeholder="https://github.com/username/repo"
                  />
                </div>
                <div>
                  <Label htmlFor="live-link">Live Demo Link</Label>
                  <Input
                    id="live-link"
                    value={formData.live_link || ''}
                    onChange={(e) => handleInputChange('live_link', e.target.value)}
                    placeholder="https://your-project.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                      {PROJECT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-8">
                  <Switch
                    id="featured"
                    checked={formData.featured || false}
                    onCheckedChange={(checked) => handleInputChange('featured', checked)}
                  />
                  <Label htmlFor="featured">Featured Project</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="tags">Technologies/Tags (comma separated)</Label>
                <Input
                  id="tags"
                  value={formData.tags?.join(', ') || ''}
                  onChange={(e) => handleTagsChange(e.target.value)}
                  placeholder="React, TypeScript, Node.js, etc."
                />
              </div>

              <div>
                <Label>Project Image</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload an image showcasing your project.
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
              <Button onClick={saveProject}>
                <Save className="h-4 w-4 mr-2" />
                {selectedProject ? 'Update' : 'Create'} Project
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
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Projects List */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading projects...</p>
            </CardContent>
          </Card>
        ) : filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? 'No projects match your search.' : 'Get started by adding your first project.'}
              </p>
              {!searchTerm && (
                <Button onClick={openNewProjectDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Project
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredProjects.map((project, index) => (
            <Card key={project.id} className="group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="flex flex-col space-y-1 mt-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                      <div className="flex flex-col space-y-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveProject(project.id, 'up')}
                          disabled={index === 0}
                          className="h-6 w-6 p-0"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveProject(project.id, 'down')}
                          disabled={index === filteredProjects.length - 1}
                          className="h-6 w-6 p-0"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-semibold text-lg">{project.title}</h3>
                        {project.featured && <Badge variant="secondary">Featured</Badge>}
                        <Badge variant="outline">{project.status}</Badge>
                        <Badge variant="outline" className="text-xs">
                          #{project.sort_order || 0}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {project.description}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(project.created_at).toLocaleDateString()}
                        </span>
                        {project.github_link && (
                          <a 
                            href={project.github_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center hover:text-foreground"
                          >
                            <Github className="h-3 w-3 mr-1" />
                            GitHub
                          </a>
                        )}
                        {project.live_link && (
                          <a 
                            href={project.live_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Live Demo
                          </a>
                        )}
                      </div>

                      {project.tags && project.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {project.tags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {project.live_link && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(project.live_link!, '_blank')}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editProject(project)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteProject(project.id)}
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