import { useLocation, useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";
import { useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, ArrowLeft, FileQuestion } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    logger.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="404 - Page Not Found | Dan Pearson"
        description="The page you're looking for doesn't exist. Navigate back to explore Dan Pearson's portfolio, AI projects, and business insights."
        keywords="404, page not found"
        url={`https://danpearson.net${location.pathname}`}
        type="website"
      />
      <Navigation />
      <main className="flex-1 pt-20 sm:pt-24 mobile-container flex items-center justify-center">
        <div className="container mx-auto mobile-section max-w-2xl">
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardContent className="mobile-card text-center">
              <div className="mb-8">
                <FileQuestion className="w-24 h-24 mx-auto text-primary/40 mb-4" />
                <h1 className="mobile-heading-lg hero-gradient-text mb-4">
                  404
                </h1>
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  Page Not Found
                </h2>
                <p className="mobile-body text-muted-foreground mb-2">
                  Oops! The page you're looking for doesn't exist.
                </p>
                <p className="text-sm text-muted-foreground">
                  Path: <code className="px-2 py-1 bg-muted rounded text-xs">{location.pathname}</code>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="btn-futuristic"
                  onClick={() => navigate('/')}
                >
                  <Home className="w-5 h-5 mr-2" />
                  Go Home
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Go Back
                </Button>
              </div>

              <div className="mt-8 pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground mb-4">
                  You might be interested in:
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/about')}
                  >
                    About Me
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/projects')}
                  >
                    Projects
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/news')}
                  >
                    News & Articles
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/ai-tools')}
                  >
                    AI Tools
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/connect')}
                  >
                    Connect
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NotFound;
