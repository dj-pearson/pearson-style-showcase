import { useId, useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTask: any;
  projects: any[];
  onSuccess: () => void;
}

export const TaskFormDialog = ({
  open,
  onOpenChange,
  editingTask,
  projects,
  onSuccess,
}: TaskFormDialogProps) => {
  const fieldId = useId();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    status: 'to_do',
    priority: 'medium',
    due_date: '',
    start_date: '',
    links: '[]',
    category: '',
    effort: '',
    dependencies: '',
    source: '',
    original_priority: '',
  });

  useEffect(() => {
    if (editingTask) {
      setFormData({
        title: editingTask.title || '',
        description: editingTask.description || '',
        project_id: editingTask.project_id || '',
        status: editingTask.status || 'to_do',
        priority: editingTask.priority || 'medium',
        due_date: editingTask.due_date ? editingTask.due_date.split('T')[0] : '',
        start_date: editingTask.start_date ? editingTask.start_date.split('T')[0] : '',
        links: JSON.stringify(editingTask.links || []),
        category: editingTask.category || '',
        effort: editingTask.effort || '',
        dependencies: editingTask.dependencies || '',
        source: editingTask.source || '',
        original_priority: editingTask.original_priority || '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        project_id: '',
        status: 'to_do',
        priority: 'medium',
        due_date: '',
        start_date: '',
        links: '[]',
        category: '',
        effort: '',
        dependencies: '',
        source: '',
        original_priority: '',
      });
    }
  }, [editingTask, open]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingTask) {
        const { error } = await supabase.from('tasks').update(data).eq('id', editingTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tasks').insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: editingTask ? 'Task updated successfully' : 'Task created successfully',
      });
      onSuccess();
    },
    onError: () =>
      toast({ title: 'Error', description: 'Failed to save task', variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      links: JSON.parse(formData.links),
      due_date: formData.due_date || null,
      start_date: formData.start_date || null,
      category: formData.category || null,
      effort: formData.effort || null,
      dependencies: formData.dependencies || null,
      source: formData.source || null,
      original_priority: formData.original_priority || null,
    };
    saveMutation.mutate(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingTask ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={`${fieldId}-title`} className="text-sm font-medium">
              Title *
            </label>
            <Input
              id={`${fieldId}-title`}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-description`} className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id={`${fieldId}-description`}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${fieldId}-category`} className="text-sm font-medium">
                Category
              </label>
              <Input
                id={`${fieldId}-category`}
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Core Auth, Security, CRM"
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-source-platform`} className="text-sm font-medium">
                Source/Platform
              </label>
              <Input
                id={`${fieldId}-source-platform`}
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                placeholder="e.g., Enterprise Readiness"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${fieldId}-project`} className="text-sm font-medium">
                Project
              </label>
              <Select
                value={formData.project_id}
                onValueChange={(value) => setFormData({ ...formData, project_id: value })}
              >
                <SelectTrigger id={`${fieldId}-project`}>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor={`${fieldId}-status`} className="text-sm font-medium">
                Status
              </label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger id={`${fieldId}-status`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="to_do">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor={`${fieldId}-priority`} className="text-sm font-medium">
                Priority
              </label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger id={`${fieldId}-priority`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor={`${fieldId}-original-priority`} className="text-sm font-medium">
                Original Priority
              </label>
              <Input
                id={`${fieldId}-original-priority`}
                value={formData.original_priority}
                onChange={(e) => setFormData({ ...formData, original_priority: e.target.value })}
                placeholder="e.g., P0-Critical"
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-effort`} className="text-sm font-medium">
                Effort
              </label>
              <Input
                id={`${fieldId}-effort`}
                value={formData.effort}
                onChange={(e) => setFormData({ ...formData, effort: e.target.value })}
                placeholder="e.g., 2 hours, 4 hours"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${fieldId}-due-date`} className="text-sm font-medium">
                Due Date
              </label>
              <Input
                id={`${fieldId}-due-date`}
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-start-date`} className="text-sm font-medium">
                Start Date
              </label>
              <Input
                id={`${fieldId}-start-date`}
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label htmlFor={`${fieldId}-dependencies`} className="text-sm font-medium">
              Dependencies
            </label>
            <Input
              id={`${fieldId}-dependencies`}
              value={formData.dependencies}
              onChange={(e) => setFormData({ ...formData, dependencies: e.target.value })}
              placeholder="e.g., OAuth state validation, CRM system"
            />
          </div>

          <div>
            <label htmlFor={`${fieldId}-links-json-array`} className="text-sm font-medium">
              Links (JSON array)
            </label>
            <Textarea
              id={`${fieldId}-links-json-array`}
              value={formData.links}
              onChange={(e) => setFormData({ ...formData, links: e.target.value })}
              rows={2}
              placeholder='["https://example.com"]'
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editingTask ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
