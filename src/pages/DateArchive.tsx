import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

const DateArchive = () => {
  useEffect(() => {
    // Legacy date-based URLs should not be indexed while the redirect resolves.
    const metaRobots = document.createElement('meta');
    metaRobots.name = 'robots';
    metaRobots.content = 'noindex, nofollow';
    document.head.appendChild(metaRobots);

    return () => {
      // Remove the exact node this effect appended. Matching by selector would
      // find SEO.tsx's shared robots meta first whenever it also reads
      // "noindex, nofollow", deleting that one and leaking this one.
      metaRobots.remove();
    };
  }, []);

  // Redirect date archives to news page
  return <Navigate to="/news" replace />;
};

export default DateArchive;
