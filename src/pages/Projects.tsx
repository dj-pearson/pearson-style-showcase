import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { ProjectCard } from '../components/ProjectCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { ProjectListSkeleton } from '@/components/skeletons';

type Project = Tables<"projects">;

const STORAGE_KEY_PREFIX = 'projectsFilters';

const Projects = () => {
  const [searchTerm, setSearchTerm] = useState(() => {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}_search`) || '';
  });
  const [selectedTag, setSelectedTag] = useState<string>(() => {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}_tag`) || 'all';
  });
  const [sortBy, setSortBy] = useState<string>(() => {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}_sort`) || 'newest';
  });

  // Persist filters to localStorage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}_search`, searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}_tag`, selectedTag);
  }, [selectedTag]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}_sort`, sortBy);
  }, [sortBy]);

  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      // Only select fields needed for project list view to reduce payload size
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, description, image_url, live_link, github_link, tags, featured, sort_order, created_at, status, updated_at')
        .order('featured', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Project[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Get unique tags for filtering - memoized
  const allTags = useMemo(() => {
    if (!projects) return [];
    return Array.from(new Set(projects.flatMap(p => p.tags || []))).sort();
  }, [projects]);

  // Filter projects - memoized to prevent recalculation on every render
  const filteredProjects = useMemo(() => {
    if (!projects) return [];

    const searchLower = searchTerm.toLowerCase();

    return projects.filter(project => {
      const matchesSearch = project.title?.toLowerCase().includes(searchLower) ||
                           project.description?.toLowerCase().includes(searchLower);
      const matchesTag = selectedTag === 'all' || project.tags?.includes(selectedTag);
      return matchesSearch && matchesTag;
    });
  }, [projects, searchTerm, selectedTag]);

  // Sort projects - memoized separately for performance
  const sortedProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
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
  }, [filteredProjects, sortBy]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTag('all');
    setSortBy('newest');
    // Clear from localStorage
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}_search`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}_tag`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}_sort`);
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
      <main id="main-content" className="flex-1 pt-20 sm:pt-24 mobile-container">
        <div className="container mx-auto max-w-7xl">
          {/* Page Header */}
          <div className="text-center mobile-section">
            <h1 className="mobile-heading-lg hero-gradient-text mb-4">
              My Projects
            </h1>
            <p className="mobile-body text-gray-400 max-w-2xl mx-auto">
              Explore my portfolio of innovative projects spanning NFT development, AI integration, and cutting-edge web solutions.
            </p>
          </div>

          {/* Search and Filter Controls - Mobile First */}
          <div className="mobile-card bg-gray-800/30 border border-gray-700 rounded-xl mb-6 sm:mb-8">
            <div className="flex flex-col gap-4">
              {/* Search */}
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 pointer-events-none" />
                <Input
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mobile-input pl-12 bg-gray-700/50 border-gray-600 focus:border-cyan-500 text-base"
                />
              </div>

              {/* Filters row */}
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                {/* Tag Filter */}
                <div className="flex-1 sm:flex-initial">
                  <Select value={selectedTag} onValueChange={setSelectedTag}>
                    <SelectTrigger className="mobile-input w-full sm:w-[200px] bg-gray-700/50 border-gray-600">
                      <Filter className="h-5 w-5 mr-2" />
                      <SelectValue placeholder="Filter by tag" />
                    </SelectTrigger>
                    <SelectContent className="mobile-modal">
                      <SelectItem value="all">All Tags</SelectItem>
                      {allTags.map(tag => (
                        <SelectItem key={tag} value={tag} className="touch-target">{tag}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort */}
                <div className="flex-1 sm:flex-initial">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="mobile-input w-full sm:w-[160px] bg-gray-700/50 border-gray-600">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent className="mobile-modal">
                      <SelectItem value="newest" className="touch-target">Newest</SelectItem>
                      <SelectItem value="oldest" className="touch-target">Oldest</SelectItem>
                      <SelectItem value="title" className="touch-target">Title A-Z</SelectItem>
                      <SelectItem value="featured" className="touch-target">Featured</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear Filters */}
                {(searchTerm || selectedTag !== 'all' || sortBy !== 'newest') && (
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="mobile-button border-gray-600 hover:border-cyan-500 active:border-cyan-500"
                  >
                    <X className="h-5 w-5 mr-2" />
                    Clear All
                  </Button>
                )}
              </div>
            </div>

            {/* Active Filters Display */}
            {(searchTerm || selectedTag !== 'all') && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-700">
                <span className="text-sm text-gray-400 font-medium">Active filters:</span>
                {searchTerm && (
                  <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-400 text-sm px-3 py-1">
                    Search: "{searchTerm}"
                  </Badge>
                )}
                {selectedTag !== 'all' && (
                  <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-400 text-sm px-3 py-1">
                    Tag: {selectedTag}
                  </Badge>
                )}
              </div>
            )}

            {/* Results Count */}
            <div className="mt-4 text-base text-gray-400 font-medium">
              Showing {sortedProjects.length} of {projects?.length || 0} projects
            </div>
          </div>

          {/* Projects Grid - Mobile First */}
          <div className="pb-12 sm:pb-16">
            {isLoading ? (
              <ProjectListSkeleton count={6} />
            ) : error ? (
              <div className="text-center mobile-section">
                <div className="mobile-card bg-destructive/10 border-destructive/30 max-w-md mx-auto">
                  <p className="text-base text-destructive">Error loading projects. Please try again later.</p>
                </div>
              </div>
            ) : projects && projects.length > 0 ? (
              sortedProjects.length > 0 ? (
                <div className="mobile-grid">
                  {sortedProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              ) : (
                <div className="text-center mobile-section">
                  <div className="mobile-card bg-muted/30 max-w-md mx-auto">
                    <p className="text-base text-gray-400 mb-4">No projects match your current filters.</p>
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      className="mobile-button border-gray-600 hover:border-cyan-500"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <div className="text-center mobile-section">
                <p className="text-base text-gray-400">No projects found.</p>
              </div>
            )}
          </div>

          {/* Bottom CTA */}
          <div className="text-center mobile-section border-t border-gray-800">
            <div className="mobile-card bg-gray-800/50 border border-cyan-500/20 max-w-2xl mx-auto">
              <h2 className="mobile-heading-md text-white mb-4">Ready to Start Your Project?</h2>
              <p className="text-base sm:text-lg text-gray-400 mb-6 leading-relaxed">
                Let's discuss how I can help bring your vision to life with innovative technology solutions.
              </p>
              <Button
                size="lg"
                className="mobile-button bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-base sm:text-lg font-bold"
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