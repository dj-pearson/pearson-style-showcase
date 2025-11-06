import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import SEO from '../components/SEO';

const About = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <SEO 
        title="About Dan Pearson | AI Engineer & Business Development Expert Background"
        description="Learn about Dan Pearson's 15+ years of experience in AI engineering, business development, and NFT development. Discover his expertise in AI integration, sales leadership, and innovative tech solutions."
        keywords="Dan Pearson bio, AI engineer background, business development expert, NFT developer experience, AI integration specialist, sales leadership, tech innovation career"
        url="https://danpearson.net/about"
        type="website"
        structuredData={{
          type: 'person',
          data: {
            name: 'Dan Pearson',
            jobTitle: 'AI Engineer & Business Development Expert',
            description: 'Experienced AI engineer and business development leader with 15+ years of expertise in AI integration, NFT development, and sales leadership.',
            url: 'https://danpearson.net/about',
            image: '/placeholder.svg',
            sameAs: [
              'https://linkedin.com/in/danpearson',
              'https://github.com/danpearson'
            ],
            worksFor: {
              '@type': 'Organization',
              name: 'Dan Pearson Consulting'
            },
            knowsAbout: [
              'Artificial Intelligence',
              'Business Development',
              'NFT Development',
              'Sales Leadership',
              'React Development',
              'Machine Learning'
            ]
          }
        }}
      />
      <Navigation />
      <main className="flex-1 pt-20 sm:pt-24 mobile-container">
        <div className="container mx-auto mobile-section">
          <div className="max-w-4xl mx-auto">
            <h1 className="mobile-heading-lg hero-gradient-text mb-8 text-center sm:text-left">
              About Me
            </h1>

            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p className="mobile-body text-muted-foreground mb-8 text-center sm:text-left">
                I'm a passionate full-stack developer with a deep interest in AI, web technologies,
                and creating innovative solutions that make a difference.
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-10">
                <div className="mobile-card bg-card/50 border border-border hover:border-primary/30 transition-colors">
                  <h2 className="mobile-heading-sm mb-4">Technical Expertise</h2>
                  <ul className="space-y-3 text-base sm:text-lg text-muted-foreground">
                    <li className="flex items-start">
                      <span className="text-primary mr-2 mt-1">•</span>
                      <span>Full-Stack Web Development</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary mr-2 mt-1">•</span>
                      <span>AI & Machine Learning Integration</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary mr-2 mt-1">•</span>
                      <span>Modern JavaScript/TypeScript</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary mr-2 mt-1">•</span>
                      <span>React, Node.js, Python</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary mr-2 mt-1">•</span>
                      <span>Database Design & Optimization</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-primary mr-2 mt-1">•</span>
                      <span>Cloud Architecture & DevOps</span>
                    </li>
                  </ul>
                </div>

                <div className="mobile-card bg-card/50 border border-border hover:border-primary/30 transition-colors">
                  <h2 className="mobile-heading-sm mb-4">What Drives Me</h2>
                  <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                    I believe technology should solve real problems and create value.
                    Whether it's building scalable web applications, integrating AI capabilities,
                    or optimizing complex systems, I'm always focused on delivering solutions
                    that exceed expectations.
                  </p>
                </div>
              </div>

              <div className="mobile-card bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/30">
                <h3 className="mobile-heading-sm mb-4">Let's Connect</h3>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                  I'm always interested in discussing new projects, innovative ideas,
                  or opportunities to collaborate. Feel free to reach out through any
                  of the channels in the footer below.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;