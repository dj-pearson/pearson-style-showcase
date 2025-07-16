import Navigation from '../components/Navigation';

const About = () => {
  return (
    <>
      <Navigation />
      <div className="min-h-screen pt-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center py-20">
            <h1 className="text-4xl font-bold mb-4 hero-gradient-text">About Me</h1>
            <p className="text-xl text-muted-foreground">Coming soon...</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default About;