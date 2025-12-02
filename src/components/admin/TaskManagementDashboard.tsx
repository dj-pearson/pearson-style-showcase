import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectsManager } from './tasks/ProjectsManager';
import { TasksManager } from './tasks/TasksManager';
import { Archive } from 'lucide-react';

export const TaskManagementDashboard = () => {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedArchiveProject, setSelectedArchiveProject] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Task Management</h2>
        <p className="text-muted-foreground">Manage your projects, tasks, and subtasks</p>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="archive" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Archive
          </TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <TasksManager 
            selectedProject={selectedProject} 
            onSelectProject={setSelectedProject}
            showArchived={false}
          />
        </TabsContent>

        <TabsContent value="archive" className="space-y-4">
          <TasksManager 
            selectedProject={selectedArchiveProject} 
            onSelectProject={setSelectedArchiveProject}
            showArchived={true}
          />
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <ProjectsManager onSelectProject={setSelectedProject} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
