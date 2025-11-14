import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Linkedin, Mail, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AuthorBylineProps {
  authorName?: string;
  showFullBio?: boolean;
}

const AuthorByline = ({ authorName = "Dan Pearson", showFullBio = true }: AuthorBylineProps) => {
  const authorInfo = {
    name: "Dan Pearson",
    title: "AI Solutions Consultant & SaaS Developer",
    bio: "Dan Pearson is an AI Solutions Consultant with 15+ years of experience in business automation and digital transformation. He has built 7 SaaS platforms serving 10,000+ users and helped 50+ businesses implement AI solutions that deliver measurable ROI. Dan specializes in integrating OpenAI, Claude, and other AI technologies to streamline business operations and reduce costs by an average of 40%.",
    credentials: [
      "15+ years in software development and business automation",
      "Founder of Pearson Media LLC with 7 active SaaS platforms",
      "Helped 50+ businesses implement AI automation",
      "Generated $2.8M+ in revenue for clients through digital transformation",
      "Expert in React, TypeScript, AI integration, and cloud architecture"
    ],
    email: "dan@danpearson.net",
    linkedin: "https://linkedin.com/in/danpearson",
    website: "https://danpearson.net"
  };

  return (
    <Card className="bg-muted/30 border-border">
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Author Avatar/Image */}
          <div className="flex-shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border-2 border-primary/30">
              <span className="text-3xl sm:text-4xl font-bold text-primary">
                {authorInfo.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
          </div>

          {/* Author Info */}
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-xl font-bold text-foreground mb-1">
                About the Author
              </h3>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-semibold text-foreground">{authorInfo.name}</span>
                <span>•</span>
                <span className="text-sm">{authorInfo.title}</span>
              </div>
            </div>

            {showFullBio && (
              <>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {authorInfo.bio}
                </p>

                {/* Credentials */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Experience & Expertise:</h4>
                  <ul className="space-y-1">
                    {authorInfo.credentials.map((credential, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
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
                <a
                  href={`mailto:${authorInfo.email}`}
                  className="flex items-center gap-2"
                >
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
