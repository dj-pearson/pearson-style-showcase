import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, CheckCircle2, Search } from 'lucide-react';
import { useIsMobile } from '../hooks/use-mobile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import GlobalSearch from './GlobalSearch';
import { Button } from './ui/button';

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const isMobile = useIsMobile();
  const { isOpen: isSearchOpen, setIsOpen: setIsSearchOpen } = useGlobalSearch();

  // Fetch availability status from profile settings
  const { data: profile } = useQuery({
    queryKey: ['profile-settings-nav'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_settings' as any)
        .select('availability_status, availability_text')
        .maybeSingle();
      if (error) throw error;
      return data as { availability_status: string; availability_text: string } | null;
    },
  });

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen, isMobile]);

  // Keyboard navigation: ESC to close menu
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isMenuOpen]);

  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'About Me', path: '/about' },
    { name: 'Projects', path: '/projects' },
    { name: 'News', path: '/news' },
    { name: 'AI Tools', path: '/ai-tools' },
    { name: 'Connect', path: '/connect' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Mobile Menu Backdrop */}
      {isMenuOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMenuOpen(false)}
          style={{ animation: 'fade-in 0.2s ease-out' }}
        />
      )}

      <nav className="fixed top-0 left-0 right-0 z-50 navbar-blur">
        <div className="container mx-auto mobile-container py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo - Mobile First with larger touch target */}
            <Link
              to="/"
              className="text-xl sm:text-xl lg:text-2xl font-bold hero-gradient-text touch-target"
              onClick={() => setIsMenuOpen(false)}
            >
              Dan Pearson
            </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-4 xl:space-x-6">
            {/* Availability Badge */}
            {profile?.availability_status === 'available' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs font-medium text-green-500">Available</span>
              </div>
            )}
            {profile?.availability_status === 'limited' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                <span className="text-xs font-medium text-yellow-500">Limited</span>
              </div>
            )}

            {/* Search Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 text-muted-foreground hover:text-primary"
            >
              <Search className="w-4 h-4" />
              <span className="hidden xl:inline">Search</span>
              <kbd className="hidden xl:inline px-1.5 py-0.5 text-xs bg-muted rounded">⌘K</kbd>
            </Button>

            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`relative px-3 py-2 text-sm font-medium transition-colors duration-200 hover:text-primary min-h-[44px] flex items-center ${
                  isActive(item.path)
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                {item.name}
                {isActive(item.path) && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
                )}
              </Link>
            ))}

            <Link
              to="/admin/login"
              className="flex items-center space-x-2 ml-4 px-3 py-2 text-xs text-muted-foreground hover:text-primary transition-colors duration-200 rounded-md hover:bg-muted/20"
            >
              <div className="w-3 h-3 rounded-full border border-primary/50"></div>
              <span>Admin</span>
            </Link>
          </div>

          {/* Mobile Menu Button - Touch Optimized */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden text-foreground hover:text-primary transition-all duration-200 touch-target rounded-lg hover:bg-primary/10 active:scale-95"
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation - Optimized for Touch & Swipe */}
        {isMenuOpen && (
          <div
            className="lg:hidden mt-4 pb-4 border-t border-border"
            style={{
              animation: 'slideDown 0.3s ease-out',
              maxHeight: 'calc(100vh - 80px)',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <div className="flex flex-col pt-4 space-y-1">
              {/* Mobile Availability Badge */}
              {profile?.availability_status === 'available' && (
                <div className="mx-4 mb-2 flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-green-500">Available for Projects</span>
                </div>
              )}
              {profile?.availability_status === 'limited' && (
                <div className="mx-4 mb-2 flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                  <span className="text-sm font-medium text-yellow-500">Limited Availability</span>
                </div>
              )}

              {navItems.map((item, index) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`px-6 py-4 text-lg font-medium transition-all duration-200 touch-target-lg flex items-center rounded-xl mx-2 ${
                    isActive(item.path)
                      ? 'text-primary bg-primary/10 shadow-lg shadow-primary/5'
                      : 'text-muted-foreground hover:bg-muted/20 active:bg-muted/30'
                  }`}
                  style={{
                    animation: `slideInRight 0.3s ease-out ${index * 0.05}s both`
                  }}
                >
                  {item.name}
                  {isActive(item.path) && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-primary"></div>
                  )}
                </Link>
              ))}

              <Link
                to="/admin/login"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center space-x-3 px-6 py-4 mt-4 border-t border-border mx-2 text-base text-muted-foreground hover:text-primary transition-all duration-200 rounded-xl hover:bg-muted/20 active:bg-muted/30 touch-target"
                style={{
                  animation: `slideInRight 0.3s ease-out ${navItems.length * 0.05}s both`
                }}
              >
                <div className="w-3 h-3 rounded-full border-2 border-primary/50"></div>
                <span>Admin Access</span>
              </Link>
            </div>

            {/* Swipe indicator */}
            <div className="flex justify-center mt-6 mb-2">
              <div className="w-12 h-1 bg-muted rounded-full"></div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile menu animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </nav>

    {/* Global Search Dialog */}
    <GlobalSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  );
};

export default Navigation;