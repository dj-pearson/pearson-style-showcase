import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { ProjectCard } from '../components/ProjectCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, X, ExternalLink, Github } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Project = Tables<"projects">;

const Projects = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

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

  // Get unique tags for filtering
  const allTags = projects 
    ? Array.from(new Set(projects.flatMap(p => p.tags || []))).sort()
    : [];

  // Filter and sort projects
  const filteredProjects = projects?.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = selectedTag === 'all' || project.tags?.includes(selectedTag);
    return matchesSearch && matchesTag;
  }) || [];

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'title':
        return a.title.localeCompare(b.title);
      case 'featured':
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      default:
        return 0;
    }
  });

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTag('all');
    setSortBy('newest');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SEO 
        title="AI & Tech Projects Portfolio | NFT Development & Business Solutions"
        description="Explore Dan Pearson's portfolio of AI projects, NFT developments, and innovative business solutions. See case studies of successful AI integrations, blockchain projects, and tech innovations."
        keywords="AI projects portfolio, NFT development projects, business solutions, AI case studies, blockchain development, tech innovation portfolio, React projects, AI integration examples"
        url="https://danpearson.net/projects"
        type="website"
        structuredData={{
          type: 'website',
          data: {
            name: 'Projects Portfolio',
            description: 'Portfolio of AI projects, NFT developments, and innovative business solutions by Dan Pearson',
            url: 'https://danpearson.net/projects',
            mainEntity: {
              '@type': 'ItemList',
              name: 'Tech Projects',
              description: 'Collection of AI, NFT, and business technology projects',
              numberOfItems: projects?.length || 0
            }
          }
        }}
      />
      <Navigation />
      <main className="flex-1 pt-20 px-4 md:px-6">
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

          {/* Search and Filter Controls */}
          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 mb-8">
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              {/* Search */}
              <div className="relative flex-1 w-full lg:max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-700/50 border-gray-600 focus:border-cyan-500"
                />
              </div>

              {/* Tag Filter */}
              <div className="w-full lg:w-auto">
                <Select value={selectedTag} onValueChange={setSelectedTag}>
                  <SelectTrigger className="w-full lg:w-[180px] bg-gray-700/50 border-gray-600">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort */}
              <div className="w-full lg:w-auto">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full lg:w-[140px] bg-gray-700/50 border-gray-600">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                    <SelectItem value="title">Title A-Z</SelectItem>
                    <SelectItem value="featured">Featured</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters */}
              {(searchTerm || selectedTag !== 'all' || sortBy !== 'newest') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="border-gray-600 hover:border-cyan-500/50"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>

            {/* Active Filters Display */}
            {(searchTerm || selectedTag !== 'all') && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-700">
                <span className="text-sm text-gray-400">Active filters:</span>
                {searchTerm && (
                  <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-400">
                    Search: "{searchTerm}"
                  </Badge>
                )}
                {selectedTag !== 'all' && (
                  <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-400">
                    Tag: {selectedTag}
                  </Badge>
                )}
              </div>
            )}

            {/* Results Count */}
            <div className="mt-4 text-sm text-gray-400">
              Showing {sortedProjects.length} of {projects?.length || 0} projects
            </div>
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
              sortedProjects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400 mb-4">No projects match your current filters.</p>
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="border-gray-600 hover:border-cyan-500/50"
                  >
                    Clear Filters
                  </Button>
                </div>
              )
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
      </main>
      <Footer />
    </div>
  );
};

export default Projects;