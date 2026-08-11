import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Linkedin, Mail, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AuthorBylineProps {
  authorName?: string;
  showFullBio?: boolean;
}

// Default credentials - can be moved to database in future.
//
// Every entry here is structural: a fact about Dan's own history or work that
// can be checked without trusting a number. The aggregate client-outcome claims
// that used to sit in this list ("Helped 50+ businesses", "Generated $2.8M+")
// were retired — see AI_CRM_AUTOMATION_STRATEGY.md §11.4. This byline appears
// beneath every article, so it is the single most-repeated set of claims on the
// site and the least forgiving place to carry an unsourced figure.
const DEFAULT_CREDENTIALS = [
  '15+ years in sales and business development before moving into automation',
  'Founder of Pearson Media LLC with 7 active SaaS platforms',
  'Publishes the Pipeline Automation Ladder and the 12-point CRM automation audit',
  'Builds capture-layer automation for HubSpot, Salesforce, Pipedrive, GoHighLevel and Zoho',
  'Works in React, TypeScript, Postgres and edge functions — including this site',
];

const DEFAULT_BIO =
  'Dan Pearson is an AI CRM automation consultant working with sales-led revenue teams of 5-50 seats. He argues that most AI CRM projects fail because they automate the reporting layer instead of the capture layer, and he builds the capture layer: automated call and meeting logging, note generation, enrichment, routing and stage-change evidence, inside the CRM a team already owns. Fifteen years carrying a quota came first; seven SaaS platforms under Pearson Media LLC came after.';

const AuthorByline = ({ authorName = 'Dan Pearson', showFullBio = true }: AuthorBylineProps) => {
  // Fetch author data from profile_settings
  const { data: profile } = useQuery({
    queryKey: ['profile-settings-author'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_settings')
        .select('bio_headline, bio_subheadline, email, linkedin_url')
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  const authorInfo = {
    name: 'Dan Pearson',
    title: profile?.bio_headline || 'AI CRM Automation Consultant',
    bio: profile?.bio_subheadline || DEFAULT_BIO,
    credentials: DEFAULT_CREDENTIALS,
    email: profile?.email || 'dan@danpearson.net',
    linkedin: profile?.linkedin_url || 'https://linkedin.com/in/danpearson',
    website: 'https://danpearson.net',
  };

  return (
    <Card className="bg-muted/30 border-border">
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Author Avatar/Image */}
          <div className="flex-shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border-2 border-primary/30">
              <span className="text-3xl sm:text-4xl font-bold text-primary">
                {authorInfo.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </span>
            </div>
          </div>

          {/* Author Info */}
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-xl font-bold text-foreground mb-1">About the Author</h3>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-semibold text-foreground">{authorInfo.name}</span>
                <span>•</span>
                <span className="text-sm">{authorInfo.title}</span>
              </div>
            </div>

            {showFullBio && (
              <>
                <p className="text-sm text-muted-foreground leading-relaxed">{authorInfo.bio}</p>

                {/* Credentials */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Experience & Expertise:</h4>
                  <ul className="space-y-1">
                    {authorInfo.credentials.map((credential, index) => (
                      <li
                        key={index}
                        className="text-sm text-muted-foreground flex items-start gap-2"
                      >
                        <span className="text-primary mt-1">•</span>
                        <span>{credential}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {/* Contact Links */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="hover:bg-primary/10 hover:border-primary"
              >
                <a
                  href={authorInfo.linkedin}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex items-center gap-2"
                >
                  <Linkedin className="w-4 h-4" />
                  LinkedIn
                </a>
              </Button>

              <Button
                variant="outline"
                size="sm"
                asChild
                className="hover:bg-primary/10 hover:border-primary"
              >
                <a href={`mailto:${authorInfo.email}`} className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </a>
              </Button>

              <Button
                variant="outline"
                size="sm"
                asChild
                className="hover:bg-primary/10 hover:border-primary"
              >
                <Link to="/connect" className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Schedule a Call
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AuthorByline;
