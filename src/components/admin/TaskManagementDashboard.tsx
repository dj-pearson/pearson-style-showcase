import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectsManager } from './tasks/ProjectsManager';
import { TasksManager } from './tasks/TasksManager';

export const TaskManagementDashboard = () => {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Task Management</h2>
        <p className="text-muted-foreground">Manage your projects, tasks, and subtasks</p>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <TasksManager selectedProject={selectedProject} onSelectProject={setSelectedProject} />
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <ProjectsManager onSelectProject={setSelectedProject} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
