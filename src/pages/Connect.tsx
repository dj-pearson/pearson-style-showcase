import Navigation from '../components/Navigation';
import Footer from '../components/Footer';

const Connect = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 pt-20">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-8 hero-gradient-text">
              Let's Connect
            </h1>
            <p className="text-xl text-muted-foreground mb-12">
              Ready to collaborate on your next project? I'd love to hear from you.
            </p>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="p-6 rounded-lg border bg-card">
                <h3 className="text-lg font-semibold mb-3">Email</h3>
                <p className="text-muted-foreground mb-4">
                  Drop me an email for project inquiries or collaboration opportunities.
                </p>
                <a 
                  href="mailto:dan@danpearson.net"
                  className="inline-flex items-center text-primary hover:underline"
                >
                  dan@danpearson.net
                </a>
              </div>
              
              <div className="p-6 rounded-lg border bg-card">
                <h3 className="text-lg font-semibold mb-3">LinkedIn</h3>
                <p className="text-muted-foreground mb-4">
                  Connect with me professionally and see my latest updates.
                </p>
                <a 
                  href="https://www.linkedin.com/in/danpearson"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-primary hover:underline"
                >
                  View Profile
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Connect;