import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { TaskFormDialog } from './TaskFormDialog';
import { TasksTable } from './TasksTable';
import { BulkImportDialog } from './BulkImportDialog';

interface TasksManagerProps {
  selectedProject: string | null;
  onSelectProject: (projectId: string | null) => void;
}

export const TasksManager = ({ selectedProject, onSelectProject }: TasksManagerProps) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const queryClient = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('title');
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', selectedProject, statusFilter, priorityFilter],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          project:projects(id, title),
          subtasks(*)
        `)
        .order('created_at', { ascending: false });

      if (selectedProject) {
        query = query.eq('project_id', selectedProject);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const handleEdit = (task: any) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Delete this task and all its subtasks?')) return;
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      toast.error('Failed to delete task');
    } else {
      toast.success('Task deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  };

  const handleUpdateField = async (taskId: string, field: string, value: any) => {
    const { error } = await supabase.from('tasks').update({ [field]: value }).eq('id', taskId);
    if (error) {
      toast.error('Failed to update task');
    } else {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  };

  if (isLoading) return <TableSkeleton rows={8} columns={7} />;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <CardTitle>Tasks</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={selectedProject || 'all'} onValueChange={(v) => onSelectProject(v === 'all' ? null : v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="to_do">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
              <Button onClick={() => { setEditingTask(null); setIsFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TasksTable
            tasks={tasks || []}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onUpdateField={handleUpdateField}
          />
        </CardContent>
      </Card>

      <TaskFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        editingTask={editingTask}
        projects={projects || []}
        onSuccess={() => {
          setIsFormOpen(false);
          setEditingTask(null);
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }}
      />

      <BulkImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        projects={projects || []}
        onSuccess={() => {
          setIsImportOpen(false);
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }}
      />
    </>
  );
};
