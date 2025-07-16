import Navigation from '../components/Navigation';
import Footer from '../components/Footer';

const About = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 pt-20">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-8 hero-gradient-text">
              About Me
            </h1>
            
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p className="text-xl text-muted-foreground mb-8">
                I'm a passionate full-stack developer with a deep interest in AI, web technologies, 
                and creating innovative solutions that make a difference.
              </p>
              
              <div className="grid md:grid-cols-2 gap-8 mb-12">
                <div>
                  <h2 className="text-2xl font-semibold mb-4">Technical Expertise</h2>
                  <ul className="space-y-2 text-muted-foreground">
                    <li>• Full-Stack Web Development</li>
                    <li>• AI & Machine Learning Integration</li>
                    <li>• Modern JavaScript/TypeScript</li>
                    <li>• React, Node.js, Python</li>
                    <li>• Database Design & Optimization</li>
                    <li>• Cloud Architecture & DevOps</li>
                  </ul>
                </div>
                
                <div>
                  <h2 className="text-2xl font-semibold mb-4">What Drives Me</h2>
                  <p className="text-muted-foreground">
                    I believe technology should solve real problems and create value. 
                    Whether it's building scalable web applications, integrating AI capabilities, 
                    or optimizing complex systems, I'm always focused on delivering solutions 
                    that exceed expectations.
                  </p>
                </div>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-3">Let's Connect</h3>
                <p className="text-muted-foreground">
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