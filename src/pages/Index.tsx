import Navigation from '../components/Navigation';
import HeroSection from '../components/HeroSection';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import CaseStudies from '../components/CaseStudies';
import NewsletterSignup from '../components/NewsletterSignup';
import { Code, Zap, Globe, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAnalytics } from '../components/Analytics';

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
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto">
          {/* Section Title */}
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-primary">
              How I Can Help
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
              Combining cutting-edge technology with proven business strategies to deliver innovative solutions
            </p>
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* NFT Development */}
            <Card className="group hover:scale-105 transition-all duration-300 bg-card/50 border-border hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/20">
              <CardContent className="p-6 sm:p-8 text-center">
                <div className="mb-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                    <Code className="w-8 h-8 text-white" />
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-4 text-foreground">NFT Development</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Unique generative collections with cutting-edge technology and mathematical precision
                </p>
              </CardContent>
            </Card>

            {/* AI Integration */}
            <Card className="group hover:scale-105 transition-all duration-300 bg-card/50 border-border hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/20">
              <CardContent className="p-6 sm:p-8 text-center">
                <div className="mb-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-4 text-foreground">AI Integration</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Leveraging OpenAI, Auto-GPT, and machine learning for innovative business solutions
                </p>
              </CardContent>
            </Card>

            {/* Sales Leadership */}
            <Card className="group hover:scale-105 transition-all duration-300 bg-card/50 border-border hover:border-green-500/50 hover:shadow-xl hover:shadow-green-500/20">
              <CardContent className="p-6 sm:p-8 text-center">
                <div className="mb-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <Globe className="w-8 h-8 text-white" />
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-4 text-foreground">Sales Leadership</h3>
                <p className="text-muted-foreground leading-relaxed">
                  15+ years driving growth, building relationships, and delivering results
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-br from-primary/10 via-background to-accent/10 border-primary/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent"></div>
            <CardContent className="relative p-8 sm:p-12 text-center">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-foreground">
                Ready to Innovate Together?
              </h2>
              <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
                Let's combine cutting-edge technology with proven business strategies to bring your vision to life.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button 
                  size="lg" 
                  className="btn-futuristic min-h-[50px] px-8 text-base"
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
                  className="min-h-[50px] px-8 text-base border-primary/50 hover:bg-primary/10"
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
      <CaseStudies />

      {/* Newsletter Signup Section */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-2xl mx-auto">
          <NewsletterSignup />
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
