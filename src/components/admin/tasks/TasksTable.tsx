import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface TasksTableProps {
  tasks: any[];
  onEdit: (task: any) => void;
  onDelete: (taskId: string) => void;
  onUpdateField: (taskId: string, field: string, value: any) => void;
}

export const TasksTable = ({ tasks, onEdit, onDelete, onUpdateField }: TasksTableProps) => {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleExpand = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return '';
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <>
              <TableRow key={task.id}>
                <TableCell>
                  {task.subtasks && task.subtasks.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(task.id)}
                    >
                      {expandedTasks.has(task.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </TableCell>
                <TableCell className="font-medium">{task.title}</TableCell>
                <TableCell>
                  {task.project && (
                    <span>{task.project.title}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={task.status}
                    onValueChange={(value) => onUpdateField(task.id, 'status', value)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="to_do">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={task.priority}
                    onValueChange={(value) => onUpdateField(task.id, 'priority', value)}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue className={getPriorityColor(task.priority)} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="date"
                    value={task.due_date ? task.due_date.split('T')[0] : ''}
                    onChange={(e) => onUpdateField(task.id, 'due_date', e.target.value || null)}
                    className="w-[150px]"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(task)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(task.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {expandedTasks.has(task.id) && task.subtasks?.map((subtask: any) => (
                <TableRow key={subtask.id} className="bg-muted/30">
                  <TableCell></TableCell>
                  <TableCell className="pl-8">↳ {subtask.title}</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                      {subtask.status}
                    </span>
                  </TableCell>
                  <TableCell className={getPriorityColor(subtask.priority)}>
                    {subtask.priority}
                  </TableCell>
                  <TableCell>
                    {subtask.due_date ? new Date(subtask.due_date).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
