import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Navigation from '../components/Navigation';
import { ProjectCard } from '../components/ProjectCard';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Project = Tables<"projects">;

const Projects = () => {
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Project[];
    },
  });

  return (
    <>
      <Navigation />
      <div className="min-h-screen pt-20 px-4 md:px-6">
        <div className="container mx-auto max-w-7xl">
          {/* Page Header */}
          <div className="text-center py-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 hero-gradient-text">
              My Projects
            </h1>
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
              Explore my portfolio of innovative projects spanning NFT development, AI integration, and cutting-edge web solutions.
            </p>
          </div>

          {/* Projects Grid */}
          <div className="pb-16">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-64 bg-gray-800/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-gray-400">Error loading projects. Please try again later.</p>
              </div>
            ) : projects && projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400">No projects found.</p>
              </div>
            )}
          </div>

          {/* Bottom CTA */}
          <div className="text-center py-16 border-t border-gray-800">
            <div className="bg-gray-800/50 border border-cyan-500/20 rounded-lg p-8 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold mb-4 text-white">Ready to Start Your Project?</h2>
              <p className="text-gray-400 mb-6">
                Let's discuss how I can help bring your vision to life with innovative technology solutions.
              </p>
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                onClick={() => window.location.href = '/connect'}
              >
                Get In Touch
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Projects;