import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

const DateArchive = () => {
  useEffect(() => {
    // Add noindex meta tag for date archives
    const metaRobots = document.createElement('meta');
    metaRobots.name = 'robots';
    metaRobots.content = 'noindex, nofollow';
    document.head.appendChild(metaRobots);

    return () => {
      // Clean up on unmount
      const existingMeta = document.querySelector('meta[name="robots"][content="noindex, nofollow"]');
      if (existingMeta) {
        document.head.removeChild(existingMeta);
      }
    };
  }, []);

  // Redirect date archives to news page
  return <Navigate to="/news" replace />;
};

export default DateArchive;