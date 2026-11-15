import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, CheckCircle2, Search } from 'lucide-react';
import { useIsMobile } from '../hooks/use-mobile';
import { useProfileSettings } from '@/hooks/useProfileSettings';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { Button, buttonVariants } from './ui/button';
import { cn } from '@/lib/utils';
import { trackCTA } from './Analytics';

// The search dialog (Dialog, ScrollArea, the static article index) is closed on
// every page load, so it is a lazy chunk mounted on first open. Hovering or
// focusing a search trigger starts the download early.
const loadGlobalSearch = () => import('./GlobalSearch');
const GlobalSearch = lazy(loadGlobalSearch);
const prefetchGlobalSearch = () => {
  void loadGlobalSearch().catch(() => undefined);
};

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isMobile = useIsMobile();
  const { isOpen: isSearchOpen, setIsOpen: setIsSearchOpen } = useGlobalSearch();
  // Stays true after the first open so the dialog keeps its state and its
  // close animation instead of unmounting.
  const [searchMounted, setSearchMounted] = useState(false);
  if (isSearchOpen && !searchMounted) setSearchMounted(true);

  // The mobile menu enters with a short CSS animation (tailwindcss-animate):
  // the panel fades and slides down 8px, then each item follows with a small
  // stagger, all inside ~250ms. This used to be a GSAP timeline, which put
  // gsap in the entry bundle for one effect. Reduced-motion users get an
  // instant menu via motion-reduce:animate-none.
  const itemAnimation =
    'animate-in fade-in-0 slide-in-from-bottom-2 duration-200 ease-out fill-mode-both motion-reduce:animate-none';

  // Availability status comes from the shared profile_settings query
  const { data: profile } = useProfileSettings();

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

  // Opening the panel moves focus to its first link so keyboard and screen
  // reader users land inside it instead of having to hunt for it.
  useEffect(() => {
    if (!isMenuOpen) return;
    mobilePanelRef.current?.querySelector<HTMLElement>('a[href], button')?.focus();
  }, [isMenuOpen]);

  // While the panel is open everything outside the nav is inert: Tab can no
  // longer walk out of the menu into the page dimmed behind the backdrop, and
  // screen readers stop reading it. Walking up from the nav and marking each
  // ancestor's other children covers #main-content, the footer and anything
  // mounted beside them (the accessibility button, banners) without knowing
  // the page's layout. The backdrop stays live so a tap on it still closes
  // the menu. Set as an attribute because React 18's DOM typings do not know
  // the inert prop.
  useEffect(() => {
    if (!isMenuOpen || !navRef.current) return;
    const madeInert: Element[] = [];
    let node: Element = navRef.current;
    while (node.parentElement && node !== document.body) {
      const parent: HTMLElement = node.parentElement;
      for (const sibling of Array.from(parent.children)) {
        if (
          sibling === node ||
          sibling === backdropRef.current ||
          sibling.hasAttribute('inert') ||
          // Global live regions (route announcer, toasts) must keep talking.
          sibling.matches('[aria-live], [role="status"], [role="alert"]') ||
          sibling.tagName === 'SCRIPT' ||
          sibling.tagName === 'STYLE'
        ) {
          continue;
        }
        sibling.setAttribute('inert', '');
        madeInert.push(sibling);
      }
      node = parent;
    }
    return () => madeInert.forEach((element) => element.removeAttribute('inert'));
  }, [isMenuOpen]);

  // Escape closes the menu and puts focus back on the toggle that opened it.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
        menuToggleRef.current?.focus();
      }
    };

    if (isMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isMenuOpen]);

  // Six is the practical ceiling on mobile, so the category entry replaces
  // "AI Tools" rather than joining it; the affiliate catalogue stays reachable
  // from the footer's quick links. /connect is not a plain item: it is the
  // primary call to action ("Book an audit") rendered as a button after them.
  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'AI CRM Automation', path: '/ai-crm-automation' },
    { name: 'Projects', path: '/projects' },
    { name: 'News', path: '/news' },
    { name: 'About', path: '/about' },
  ];
  const ctaItem = { name: 'Book an audit', path: '/connect' };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Skip to content link for keyboard accessibility - WCAG 2.1 Level A */}
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      {/* Mobile Menu Backdrop */}
      {isMenuOpen && (
        // Dismiss-on-tap backdrop. aria-hidden keeps it out of the tree entirely,
        // which is correct: the keyboard path is Escape, handled above, and the
        // toggle button carries aria-expanded. A focusable backdrop would sit
        // between the user and the menu it is meant to close.
        <div
          ref={backdropRef}
          aria-hidden="true"
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMenuOpen(false)}
          style={{ animation: 'fade-in 0.2s ease-out' }}
        />
      )}

      <nav
        ref={navRef}
        className="fixed top-0 left-0 right-0 z-50 navbar-blur"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="container mx-auto mobile-container py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo - Mobile First with larger touch target */}
            <Link
              to="/"
              className="text-xl sm:text-xl lg:text-2xl font-bold text-primary touch-target"
              onClick={() => setIsMenuOpen(false)}
            >
              Dan Pearson
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-4 xl:space-x-6">
              {/* Availability Badge */}
              {profile?.availability_status === 'available' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" aria-hidden="true" />
                  <span className="text-xs font-medium text-green-500">Available</span>
                </div>
              )}
              {profile?.availability_status === 'limited' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                  <div
                    className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"
                    aria-hidden="true"
                  ></div>
                  <span className="text-xs font-medium text-yellow-500">Limited</span>
                </div>
              )}

              {/* Search Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSearchOpen(true)}
                onPointerEnter={prefetchGlobalSearch}
                onFocus={prefetchGlobalSearch}
                className="flex items-center gap-2 text-muted-foreground hover:text-primary"
                aria-label="Open search"
              >
                <Search className="w-4 h-4" aria-hidden="true" />
                <span className="hidden xl:inline">Search</span>
                <kbd className="hidden xl:inline px-1.5 py-0.5 text-xs bg-muted rounded">⌘K</kbd>
              </Button>

              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  aria-current={isActive(item.path) ? 'page' : undefined}
                  className={`relative px-3 py-2 text-sm font-medium transition-colors duration-200 hover:text-primary min-h-[44px] flex items-center ${
                    isActive(item.path) ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {item.name}
                  {isActive(item.path) && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
                  )}
                </Link>
              ))}

              <Link
                to={ctaItem.path}
                aria-current={isActive(ctaItem.path) ? 'page' : undefined}
                onClick={() => trackCTA(ctaItem.name, 'Nav desktop', ctaItem.path)}
                className={buttonVariants({ size: 'sm' })}
              >
                {ctaItem.name}
              </Link>
            </div>

            {/* Mobile header controls. Search lived only in the desktop bar and
                behind Cmd+K, neither of which exists on a phone, so search was
                unreachable below 1024px. */}
            <div className="flex items-center gap-1 lg:hidden">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsSearchOpen(true);
                }}
                onPointerEnter={prefetchGlobalSearch}
                onFocus={prefetchGlobalSearch}
                className="text-foreground hover:text-primary transition-all duration-200 touch-target rounded-lg hover:bg-primary/10 active:scale-95"
                aria-label="Open search"
              >
                <Search size={24} aria-hidden="true" />
              </button>

              {/* Mobile Menu Button - Touch Optimized */}
              <button
                ref={menuToggleRef}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-foreground hover:text-primary transition-all duration-200 touch-target rounded-lg hover:bg-primary/10 active:scale-95"
                aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={isMenuOpen}
                aria-controls="mobile-navigation-menu"
              >
                {isMenuOpen ? (
                  <X size={24} aria-hidden="true" />
                ) : (
                  <Menu size={24} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile navigation panel. Plain links inside the main <nav>, so no
              menu role: role="menu" promises arrow-key menu behaviour that
              links do not have. */}
          {isMenuOpen && (
            <div
              ref={mobilePanelRef}
              id="mobile-navigation-menu"
              className="lg:hidden mt-4 pb-4 border-t border-border animate-in fade-in-0 slide-in-from-top-2 duration-200 ease-out motion-reduce:animate-none"
              style={{
                maxHeight: 'calc(100vh - 80px)',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <div className="flex flex-col pt-4 space-y-1">
                {/* Mobile Availability Badge */}
                {profile?.availability_status === 'available' && (
                  <div className="mx-4 mb-2 flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="w-4 h-4 text-green-500" aria-hidden="true" />
                    <span className="text-sm font-medium text-green-500">
                      Available for Projects
                    </span>
                  </div>
                )}
                {profile?.availability_status === 'limited' && (
                  <div className="mx-4 mb-2 flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                    <div
                      className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"
                      aria-hidden="true"
                    ></div>
                    <span className="text-sm font-medium text-yellow-500">
                      Limited Availability
                    </span>
                  </div>
                )}

                {navItems.map((item, index) => (
                  <Link
                    key={item.name}
                    to={item.path}
                    aria-current={isActive(item.path) ? 'page' : undefined}
                    onClick={() => setIsMenuOpen(false)}
                    style={{ animationDelay: `${20 + index * 15}ms` }}
                    className={`mobile-nav-item ${itemAnimation} relative px-6 py-4 text-lg font-medium transition-all duration-200 touch-target-lg flex items-center rounded-xl mx-2 ${
                      isActive(item.path)
                        ? 'text-primary bg-primary/10 shadow-lg shadow-primary/5'
                        : 'text-muted-foreground hover:bg-muted/20 active:bg-muted/30'
                    }`}
                  >
                    {item.name}
                    {/* Positioned out of the flow so the label stays centred
                        like the other items instead of being pushed left. */}
                    {isActive(item.path) && (
                      <span
                        aria-hidden="true"
                        className="absolute right-6 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary"
                      />
                    )}
                  </Link>
                ))}

                <div className={`px-2 pt-3 ${itemAnimation}`}>
                  <Link
                    to={ctaItem.path}
                    aria-current={isActive(ctaItem.path) ? 'page' : undefined}
                    onClick={() => {
                      trackCTA(ctaItem.name, 'Nav mobile', ctaItem.path);
                      setIsMenuOpen(false);
                    }}
                    className={cn(buttonVariants({ size: 'lg' }), 'w-full text-base')}
                  >
                    {ctaItem.name}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Backdrop fade (mobile menu items/container use tailwindcss-animate) */}
        <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      </nav>

      {/* Global Search Dialog */}
      {searchMounted && (
        <Suspense fallback={null}>
          <GlobalSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />
        </Suspense>
      )}
    </>
  );
};

export default Navigation;
