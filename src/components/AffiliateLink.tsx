import { supabase } from "@/integrations/supabase/client";
import { ExternalLink } from "lucide-react";

interface AffiliateLinkProps {
  href: string;
  asin: string;
  articleId: string;
  children: React.ReactNode;
  className?: string;
}

export const AffiliateLink = ({ href, asin, articleId, children, className = "" }: AffiliateLinkProps) => {
  const trackClick = async () => {
    try {
      // Track the click via edge function
      await supabase.functions.invoke('track-affiliate-click', {
        body: { articleId, asin }
      });
    } catch (error) {
      console.error('Failed to track click:', error);
      // Don't block navigation on tracking failure
    }
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      className={`inline-flex items-center gap-1 text-primary hover:underline ${className}`}
      onClick={trackClick}
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
};