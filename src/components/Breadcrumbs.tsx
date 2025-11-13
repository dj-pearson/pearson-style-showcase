import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import SEO from './SEO';

interface BreadcrumbItem {
  label: string;
  path: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

const Breadcrumbs = ({ items, className = '' }: BreadcrumbsProps) => {
  const location = useLocation();

  // Auto-generate breadcrumbs from URL if not provided
  const breadcrumbs = items || generateBreadcrumbs(location.pathname);

  // Always include home
  const allBreadcrumbs = [
    { label: 'Home', path: '/' },
    ...breadcrumbs,
  ];

  // Generate structured data for breadcrumbs
  const structuredDataItems = allBreadcrumbs.map((item, index) => ({
    name: item.label,
    url: `https://danpearson.net${item.path}`,
  }));

  return (
    <>
      {/* Structured data for SEO */}
      <SEO
        structuredData={{
          type: 'breadcrumb',
          data: { items: structuredDataItems },
        }}
      />

      {/* Visual breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className={`flex items-center space-x-2 text-sm ${className}`}
      >
        <ol className="flex items-center space-x-2" itemScope itemType="https://schema.org/BreadcrumbList">
          {allBreadcrumbs.map((crumb, index) => {
            const isLast = index === allBreadcrumbs.length - 1;
            const isFirst = index === 0;

            return (
              <li
                key={crumb.path}
                className="flex items-center"
                itemProp="itemListElement"
                itemScope
                itemType="https://schema.org/ListItem"
              >
                {/* Separator */}
                {!isFirst && (
                  <ChevronRight className="w-4 h-4 mx-2 text-muted-foreground" aria-hidden="true" />
                )}

                {/* Breadcrumb link or text */}
                {isLast ? (
                  <span
                    className="text-foreground font-medium"
                    itemProp="name"
                    aria-current="page"
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                    itemProp="item"
                  >
                    {isFirst && <Home className="w-4 h-4" aria-hidden="true" />}
                    <span itemProp="name">{crumb.label}</span>
                  </Link>
                )}

                {/* Hidden position for structured data */}
                <meta itemProp="position" content={String(index + 1)} />
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
};

// Helper function to generate breadcrumbs from pathname
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  // Remove leading/trailing slashes and split
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return [];
  }

  // Map of routes to readable labels
  const routeLabels: Record<string, string> = {
    about: 'About Me',
    projects: 'Projects',
    news: 'News',
    'ai-tools': 'AI Tools',
    connect: 'Connect',
    admin: 'Admin',
    dashboard: 'Dashboard',
    login: 'Login',
  };

  const breadcrumbs: BreadcrumbItem[] = [];
  let currentPath = '';

  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;

    // Use mapped label or capitalize segment
    const label = routeLabels[segment] || capitalizeWords(segment.replace(/-/g, ' '));

    breadcrumbs.push({
      label,
      path: currentPath,
    });
  });

  return breadcrumbs;
}

// Helper to capitalize words
function capitalizeWords(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export default Breadcrumbs;
