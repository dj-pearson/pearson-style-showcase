import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const URLHandler = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();

  useEffect(() => {
    
    const canonicalUrl = `https://danpearson.net${location.pathname}${location.search}`;

    // Handle case sensitivity redirects
    if (location.pathname === '/News') {
      window.location.replace('/news');
      return;
    }

    // Update canonical URL for URL parameters
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', location.search ? 
        `https://danpearson.net${location.pathname}` : 
        canonicalUrl
      );
    } else {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      canonicalLink.setAttribute('href', location.search ? 
        `https://danpearson.net${location.pathname}` : 
        canonicalUrl
      );
      document.head.appendChild(canonicalLink);
    }
  }, [location]);

  // Handle case-sensitive route redirects
  if (location.pathname === '/News') {
    return <Navigate to="/news" replace />;
  }

  return <>{children}</>;
};

export default URLHandler;