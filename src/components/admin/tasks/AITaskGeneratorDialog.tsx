import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sparkles,
  Loader2,
  Check,
  X,
  Trash2,
  Edit2,
  AlertTriangle,
  ClipboardPaste,
  Wand2
} from 'lucide-react';

interface AITaskGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: any[];
  defaultProjectId?: string | null;
  onSuccess: () => void;
}

interface GeneratedTask {
  title: string;
  description?: string | null;
  category?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  effort?: string | null;
  dependencies?: string | null;
  selected: boolean;
  editing: boolean;
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export const AITaskGeneratorDialog = ({
  open,
  onOpenChange,
  projects,
  defaultProjectId,
  onSuccess
}: AITaskGeneratorDialogProps) => {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [selectedProject, setSelectedProject] = useState<string>(defaultProjectId || '');
  const [inputText, setInputText] = useState('');
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [summary, setSummary] = useState('');
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedProject(defaultProjectId || '');
      setInputText('');
      setGeneratedTasks([]);
      setSummary('');
      setStep('input');
      setEditingIndex(null);
    }
  }, [open, defaultProjectId]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const projectName = projects.find(p => p.id === selectedProject)?.name;

      const { data, error } = await supabase.functions.invoke('generate-ai-tasks', {
        body: {
          text: inputText,
          project_id: selectedProject || null,
          project_name: projectName || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      if (data?.tasks && Array.isArray(data.tasks)) {
        setGeneratedTasks(data.tasks.map((task: any) => ({
          ...task,
          selected: true,
          editing: false,
        })));
        setSummary(data.summary || '');
        setStep('review');
        toast({
          title: 'Tasks Generated',
          description: `AI found ${data.tasks.length} task${data.tasks.length !== 1 ? 's' : ''} in your text`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate tasks from text',
        variant: 'destructive',
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const selectedTasks = generatedTasks.filter(t => t.selected);

      if (selectedTasks.length === 0) {
        throw new Error('No tasks selected');
      }

      const tasksToInsert = selectedTasks.map(task => ({
        title: task.title,
        description: task.description || null,
        category: task.category || null,
        priority: task.priority,
        effort: task.effort || null,
        dependencies: task.dependencies || null,
        project_id: selectedProject || null,
        status: 'to_do',
        source: 'AI Generated',
      }));

      const { error } = await supabase.from('tasks').insert(tasksToInsert);
      if (error) throw error;

      return selectedTasks.length;
    },
    onSuccess: (count) => {
      toast({
        title: 'Tasks Created',
        description: `Successfully added ${count} task${count !== 1 ? 's' : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Save',
        description: error.message || 'Could not save tasks',
        variant: 'destructive',
      });
    },
  });

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInputText(text);
      toast({
        title: 'Pasted',
        description: 'Text pasted from clipboard',
      });
    } catch {
      toast({
        title: 'Paste Failed',
        description: 'Could not access clipboard. Please paste manually.',
        variant: 'destructive',
      });
    }
  };

  const toggleTaskSelection = (index: number) => {
    setGeneratedTasks(prev =>
      prev.map((task, i) =>
        i === index ? { ...task, selected: !task.selected } : task
      )
    );
  };

  const removeTask = (index: number) => {
    setGeneratedTasks(prev => prev.filter((_, i) => i !== index));
  };

  const updateTask = (index: number, updates: Partial<GeneratedTask>) => {
    setGeneratedTasks(prev =>
      prev.map((task, i) =>
        i === index ? { ...task, ...updates } : task
      )
    );
  };

  const selectAll = () => {
    setGeneratedTasks(prev => prev.map(t => ({ ...t, selected: true })));
  };

  const deselectAll = () => {
    setGeneratedTasks(prev => prev.map(t => ({ ...t, selected: false })));
  };

  const selectedCount = generatedTasks.filter(t => t.selected).length;

  const content = (
    <div className="flex flex-col h-full">
      {step === 'input' ? (
        <div className="flex flex-col gap-4 p-1">
          {/* Project Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Project (Optional)</label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No Project</SelectItem>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: project.color || '#6366f1' }}
                      />
                      <span className="truncate">{project.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Text Input Area */}
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Paste Your Text</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePaste}
                className="h-8 px-2 text-xs"
              >
                <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
                Paste
              </Button>
            </div>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste text containing tasks here. The AI will analyze it and extract individual tasks for you.

Examples:
- A list of to-dos from an email
- Meeting notes with action items
- Requirements from a document
- Bug reports or feature requests"
              className="min-h-[200px] sm:min-h-[250px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {inputText.length > 0
                ? `${inputText.length} characters`
                : 'Paste or type text containing tasks to extract'}
            </p>
          </div>

          {/* Generate Button */}
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={!inputText.trim() || generateMutation.isPending}
            className="w-full h-12 text-base"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-5 w-5" />
                Generate Tasks with AI
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col h-full gap-4 p-1">
          {/* Summary */}
          {summary && (
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <Sparkles className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
              <p className="text-sm text-muted-foreground">{summary}</p>
            </div>
          )}

          {/* Selection controls */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {selectedCount} of {generatedTasks.length} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll} className="h-8 text-xs">
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAll} className="h-8 text-xs">
                Deselect All
              </Button>
            </div>
          </div>

          {/* Tasks List */}
          <ScrollArea className="flex-1 -mx-1 px-1">
            <div className="space-y-3">
              {generatedTasks.map((task, index) => (
                <Card
                  key={index}
                  className={`transition-all ${
                    task.selected
                      ? 'border-primary/50 bg-background'
                      : 'border-muted bg-muted/30 opacity-60'
                  }`}
                >
                  <CardContent className="p-3 sm:p-4">
                    {editingIndex === index ? (
                      // Edit Mode
                      <div className="space-y-3">
                        <Input
                          value={task.title}
                          onChange={(e) => updateTask(index, { title: e.target.value })}
                          placeholder="Task title"
                          className="font-medium"
                        />
                        <Textarea
                          value={task.description || ''}
                          onChange={(e) => updateTask(index, { description: e.target.value })}
                          placeholder="Description (optional)"
                          rows={2}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Select
                            value={task.priority}
                            onValueChange={(v: any) => updateTask(index, { priority: v })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={task.category || ''}
                            onChange={(e) => updateTask(index, { category: e.target.value })}
                            placeholder="Category"
                            className="h-9"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingIndex(null)}
                          >
                            Done
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={task.selected}
                          onCheckedChange={() => toggleTaskSelection(index)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm sm:text-base leading-tight">
                              {task.title}
                            </h4>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingIndex(index)}
                                className="h-7 w-7 p-0"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeTask(index)}
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge className={priorityColors[task.priority]} variant="secondary">
                              {task.priority}
                            </Badge>
                            {task.category && (
                              <Badge variant="outline" className="text-xs">
                                {task.category}
                              </Badge>
                            )}
                            {task.effort && (
                              <span className="text-xs text-muted-foreground">
                                {task.effort}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => setStep('input')}
              className="sm:flex-1"
            >
              <X className="mr-2 h-4 w-4" />
              Back to Edit
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={selectedCount === 0 || saveMutation.isPending}
              className="sm:flex-1"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Add {selectedCount} Task{selectedCount !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  // Use Sheet on mobile, Dialog on desktop
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] flex flex-col">
          <SheetHeader className="text-left pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Task Generator
            </SheetTitle>
            <SheetDescription>
              {step === 'input'
                ? 'Paste text and let AI extract tasks for you'
                : 'Review and customize the generated tasks'}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Task Generator
          </DialogTitle>
          <DialogDescription>
            {step === 'input'
              ? 'Paste text and let AI extract tasks for you'
              : 'Review and customize the generated tasks'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
};
