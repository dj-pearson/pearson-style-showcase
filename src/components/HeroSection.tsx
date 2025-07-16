import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

const HeroSection = () => {
  const [binaryStrings, setBinaryStrings] = useState<Array<{
    id: number;
    text: string;
    x: number;
    y: number;
    delay: number;
  }>>([]);

  const techBadges = [
    { name: 'LEADERSHIP', position: { top: '20%', left: '15%' }, color: 'tech-blue' },
    { name: 'INNOVATION', position: { top: '40%', left: '10%' }, color: 'tech-purple' },
    { name: 'NFT', position: { top: '60%', right: '10%' }, color: 'tech-orange' },
    { name: 'AI', position: { top: '30%', right: '20%' }, color: 'tech-green' },
    { name: 'BLOCKCHAIN', position: { bottom: '30%', left: '20%' }, color: 'tech-red' },
    { name: 'SALES', position: { bottom: '20%', right: '15%' }, color: 'tech-cyan' },
  ];

  // Generate random binary strings
  useEffect(() => {
    const generateBinaryStrings = () => {
      const strings = [];
      for (let i = 0; i < 12; i++) {
        const binaryLength = Math.floor(Math.random() * 8) + 4;
        const binaryText = Array.from({ length: binaryLength }, () => 
          Math.random() > 0.5 ? '1' : '0'
        ).join('');
        
        strings.push({
          id: i,
          text: binaryText,
          x: Math.random() * 100,
          y: Math.random() * 100,
          delay: Math.random() * 2
        });
      }
      setBinaryStrings(strings);
    };

    generateBinaryStrings();
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/20"></div>

      {/* Binary code background */}
      {binaryStrings.map((binary) => (
        <div
          key={binary.id}
          className="binary-code"
          style={{
            left: `${binary.x}%`,
            top: `${binary.y}%`,
            animationDelay: `${binary.delay}s`
          }}
        >
          {binary.text}
        </div>
      ))}

      {/* Floating circles */}
      <div className="floating-circle w-96 h-96 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
      <div className="floating-circle w-80 h-80 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ animationDirection: 'reverse', animationDuration: '30s' }}></div>
      <div className="floating-circle w-64 h-64 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ animationDuration: '25s' }}></div>

      {/* Tech badges */}
      {techBadges.map((badge, index) => (
        <div
          key={badge.name}
          className="absolute tech-badge hover-scale cursor-pointer"
          style={{
            ...badge.position,
            animationDelay: `${index * 0.2}s`
          }}
        >
          {badge.name}
        </div>
      ))}

      {/* Main content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
        {/* Main title */}
        <h1 className="text-6xl md:text-8xl font-bold mb-6 glow-effect">
          <span className="hero-gradient-text">Dan</span>
          <span className="text-foreground">Pearson</span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-muted-foreground mb-8 font-light">
          Sales Leader <span className="text-primary">•</span> NFT Developer <span className="text-primary">•</span> AI Enthusiast
        </p>

        {/* CTA Button */}
        <button className="btn-futuristic group">
          Explore My Work
          <ArrowRight className="inline-block ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-10 right-10 w-2 h-2 bg-primary rounded-full animate-ping"></div>
      <div className="absolute bottom-20 left-10 w-1 h-1 bg-tech-cyan rounded-full animate-pulse"></div>
      <div className="absolute top-1/4 right-1/4 w-1.5 h-1.5 bg-tech-purple rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
      <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-tech-orange rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
    </section>
  );
};

export default HeroSection;