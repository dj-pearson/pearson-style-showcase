import { lazy, Suspense } from 'react';
import Navigation from '../components/Navigation';
import HeroSection from '../components/HeroSection';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { Code, Zap, Globe, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAnalytics } from '../components/Analytics';

// Lazy load below-the-fold components to improve FID
const CaseStudies = lazy(() => import('../components/CaseStudies'));
const NewsletterSignup = lazy(() => import('../components/NewsletterSignup'));

const Index = () => {
  const { trackClick } = useAnalytics();
  return (
    <div className="min-h-screen flex flex-col">
      <SEO 
        title="Dan Pearson - AI Engineer & Business Development Expert | AI Solutions & NFT Development"
        description="Expert AI engineer and business development leader specializing in AI integration, NFT development, and innovative tech solutions. Transform your business with cutting-edge AI technologies and strategic development."
        keywords="AI engineer, business development, NFT development, AI integration, artificial intelligence, machine learning, blockchain development, React developer, tech innovation, AI solutions, business transformation, software development"
        url="https://danpearson.net"
        type="website"
        structuredData={{
          type: 'person',
          data: {
            name: 'Dan Pearson',
            jobTitle: 'AI Engineer & Business Development Expert',
            description: 'Expert AI engineer and business development leader specializing in AI integration, NFT development, and innovative tech solutions.',
            url: 'https://danpearson.net',
            image: '/placeholder.svg',
            sameAs: [
              'https://linkedin.com/in/danpearson',
              'https://github.com/danpearson'
            ],
            worksFor: {
              '@type': 'Organization',
              name: 'Dan Pearson Consulting'
            },
            address: {
              '@type': 'PostalAddress',
              addressCountry: 'US'
            }
          }
        }}
      />
      <Navigation />
      <HeroSection />
      
      {/* Services Preview Section */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto">
          {/* Section Title */}
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 text-primary leading-tight">
              How I Can Help
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto px-2 leading-relaxed">
              Combining cutting-edge technology with proven business strategies to deliver innovative solutions
            </p>
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {/* NFT Development */}
            <Card className="group hover:scale-105 transition-all duration-300 bg-card/50 border-border hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/20">
              <CardContent className="p-6 sm:p-8 lg:p-10 text-center">
                <div className="mb-4 sm:mb-6">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                    <Code className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-foreground">NFT Development</h3>
                <p className="text-base text-muted-foreground leading-relaxed">
                  Unique generative collections with cutting-edge technology and mathematical precision
                </p>
              </CardContent>
            </Card>

            {/* AI Integration */}
            <Card className="group hover:scale-105 transition-all duration-300 bg-card/50 border-border hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/20">
              <CardContent className="p-6 sm:p-8 lg:p-10 text-center">
                <div className="mb-4 sm:mb-6">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <Zap className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-foreground">AI Integration</h3>
                <p className="text-base text-muted-foreground leading-relaxed">
                  Leveraging OpenAI, Auto-GPT, and machine learning for innovative business solutions
                </p>
              </CardContent>
            </Card>

            {/* Sales Leadership */}
            <Card className="group hover:scale-105 transition-all duration-300 bg-card/50 border-border hover:border-green-500/50 hover:shadow-xl hover:shadow-green-500/20">
              <CardContent className="p-6 sm:p-8 lg:p-10 text-center">
                <div className="mb-4 sm:mb-6">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <Globe className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-foreground">Sales Leadership</h3>
                <p className="text-base text-muted-foreground leading-relaxed">
                  15+ years driving growth, building relationships, and delivering results
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-br from-primary/10 via-background to-accent/10 border-primary/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent"></div>
            <CardContent className="relative p-6 sm:p-10 lg:p-12 text-center">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 sm:mb-6 text-foreground leading-tight">
                Ready to Innovate Together?
              </h2>
              <p className="text-base sm:text-lg lg:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed px-2">
                Let's combine cutting-edge technology with proven business strategies to bring your vision to life.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center">
                <Button 
                  size="lg" 
                  className="btn-futuristic min-h-[48px] sm:min-h-[52px] px-6 sm:px-8 text-base w-full sm:w-auto"
                  onClick={() => {
                    trackClick('View Projects CTA', 'Homepage');
                    window.location.href = '/projects';
                  }}
                >
                  View My Projects
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="min-h-[48px] sm:min-h-[52px] px-6 sm:px-8 text-base border-primary/50 hover:bg-primary/10 w-full sm:w-auto"
                  onClick={() => {
                    trackClick('Get In Touch CTA', 'Homepage');
                    window.location.href = '/connect';
                  }}
                >
                  Get In Touch
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Case Studies Section */}
      <Suspense fallback={<div className="py-16 text-center text-muted-foreground">Loading case studies...</div>}>
        <CaseStudies />
      </Suspense>

      {/* Newsletter Signup Section */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-2xl mx-auto">
          <Suspense fallback={<div className="text-center text-muted-foreground py-8">Loading newsletter...</div>}>
            <NewsletterSignup />
          </Suspense>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
