import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to automatically track clicks on Amazon affiliate links within an article
 * Usage: Call this hook in your Article component with the article ID
 */
export const useAffiliateTracking = (articleId: string) => {
  useEffect(() => {
    const handleLinkClick = async (event: MouseEvent) => {
      const target = event.target as HTMLAnchorElement;
      
      // Check if this is an Amazon affiliate link
      if (target.tagName === 'A' && target.href.includes('amazon.com')) {
        // Extract ASIN from URL
        const asinMatch = target.href.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})/);
        const asin = asinMatch ? (asinMatch[1] || asinMatch[2]) : null;
        
        if (asin) {
          try {
            // Track the click asynchronously (don't block navigation)
            supabase.functions.invoke('track-affiliate-click', {
              body: { articleId, asin }
            }).catch(err => logger.error('Failed to track click:', err));
          } catch (error) {
            logger.error('Error tracking affiliate click:', error);
          }
        }
      }
    };

    // Add click listener to document
    document.addEventListener('click', handleLinkClick);

    // Cleanup
    return () => {
      document.removeEventListener('click', handleLinkClick);
    };
  }, [articleId]);
};

/**
 * Helper function to manually track a click
 */
export const trackAffiliateClick = async (articleId: string, asin: string) => {
  try {
    await supabase.functions.invoke('track-affiliate-click', {
      body: { articleId, asin }
    });
  } catch (error) {
    logger.error('Failed to track click:', error);
  }
};