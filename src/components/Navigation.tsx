import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useIsMobile } from '../hooks/use-mobile';

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const isMobile = useIsMobile();

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
    <nav className="fixed top-0 left-0 right-0 z-50 navbar-blur">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo - Mobile First */}
          <Link to="/" className="text-lg sm:text-xl lg:text-2xl font-bold hero-gradient-text">
            Dan Pearson
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-6 xl:space-x-8">
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
            
            <div className="flex items-center space-x-2 ml-4">
              <div className="w-3 h-3 rounded-full border border-primary/50"></div>
              <span className="text-xs text-muted-foreground">Admin</span>
            </div>
          </div>

          {/* Mobile Menu Button - Touch Optimized */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden text-foreground hover:text-primary transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Toggle navigation menu"
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Navigation - Optimized for Touch */}
        {isMenuOpen && (
          <div 
            className="lg:hidden mt-4 pb-4 border-t border-border animate-fade-in"
            style={{ 
              animation: 'fade-in 0.2s ease-out',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
          >
            <div className="flex flex-col pt-4">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`px-4 py-3 text-base font-medium transition-colors duration-200 hover:text-primary min-h-[44px] flex items-center rounded-lg mx-2 ${
                    isActive(item.path) 
                      ? 'text-primary bg-primary/10' 
                      : 'text-muted-foreground hover:bg-muted/20'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              
              <div className="flex items-center space-x-2 px-4 py-3 mt-2 border-t border-border mx-2">
                <div className="w-3 h-3 rounded-full border border-primary/50"></div>
                <span className="text-sm text-muted-foreground">Admin</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;