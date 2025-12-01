import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTask: any;
  projects: any[];
  onSuccess: () => void;
}

export const TaskFormDialog = ({ open, onOpenChange, editingTask, projects, onSuccess }: TaskFormDialogProps) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    status: 'to_do',
    priority: 'medium',
    due_date: '',
    start_date: '',
    links: '[]',
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
      toast.success(editingTask ? 'Task updated successfully' : 'Task created successfully');
      onSuccess();
    },
    onError: () => toast.error('Failed to save task'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      links: JSON.parse(formData.links),
      due_date: formData.due_date || null,
      start_date: formData.start_date || null,
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
            <label className="text-sm font-medium">Title *</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Project</label>
              <Select value={formData.project_id} onValueChange={(value) => setFormData({ ...formData, project_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                <SelectTrigger>
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
              <label className="text-sm font-medium">Due Date</label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Links (JSON array)</label>
            <Textarea
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
