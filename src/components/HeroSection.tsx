import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useIsMobile } from '../hooks/use-mobile';

const HeroSection = () => {
  const isMobile = useIsMobile();
  const [binaryStrings, setBinaryStrings] = useState<Array<{
    id: number;
    text: string;
    x: number;
    y: number;
    delay: number;
  }>>([]);

  const techBadges = [
    { name: 'LEADERSHIP', position: { 
      mobile: { top: '15%', left: '5%' }, 
      desktop: { top: '20%', left: '15%' } 
    }, color: 'tech-blue' },
    { name: 'INNOVATION', position: { 
      mobile: { top: '25%', left: '5%' }, 
      desktop: { top: '40%', left: '10%' } 
    }, color: 'tech-purple' },
    { name: 'NFT', position: { 
      mobile: { top: '70%', right: '5%' }, 
      desktop: { top: '60%', right: '10%' } 
    }, color: 'tech-orange' },
    { name: 'AI', position: { 
      mobile: { top: '15%', right: '5%' }, 
      desktop: { top: '30%', right: '20%' } 
    }, color: 'tech-green' },
    { name: 'BLOCKCHAIN', position: { 
      mobile: { bottom: '25%', left: '5%' }, 
      desktop: { bottom: '30%', left: '20%' } 
    }, color: 'tech-red' },
    { name: 'SALES', position: { 
      mobile: { bottom: '15%', right: '5%' }, 
      desktop: { bottom: '20%', right: '15%' } 
    }, color: 'tech-cyan' },
  ];

  // Generate random binary strings - Optimized for mobile
  useEffect(() => {
    const generateBinaryStrings = () => {
      const strings = [];
      const count = isMobile ? 6 : 12; // Fewer on mobile for performance
      for (let i = 0; i < count; i++) {
        const binaryLength = Math.floor(Math.random() * (isMobile ? 6 : 8)) + 4;
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
  }, [isMobile]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16 sm:pt-20">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/20"></div>

      {/* Binary code background - Reduced on mobile */}
      {!isMobile && binaryStrings.map((binary) => (
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

      {/* Floating circles - Responsive sizing */}
      {!isMobile && (
        <>
          <div className="floating-circle w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
          <div className="floating-circle w-48 h-48 sm:w-64 sm:h-64 lg:w-80 lg:h-80 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ animationDirection: 'reverse', animationDuration: '30s' }}></div>
          <div className="floating-circle w-32 h-32 sm:w-48 sm:h-48 lg:w-64 lg:h-64 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ animationDuration: '25s' }}></div>
        </>
      )}

      {/* Tech badges - Responsive positioning */}
      {techBadges.map((badge, index) => (
        <div
          key={badge.name}
          className="absolute tech-badge hover-scale cursor-pointer text-xs sm:text-sm"
          style={{
            ...(isMobile ? badge.position.mobile : badge.position.desktop),
            animationDelay: `${index * 0.2}s`
          }}
        >
          {badge.name}
        </div>
      ))}

      {/* Main content - Mobile First Typography */}
      <div className="relative z-10 text-center max-w-sm sm:max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6">
        {/* Main title - Mobile First Sizing */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-4 sm:mb-6 glow-effect leading-tight">
          <span className="hero-gradient-text">Dan</span>
          <span className="text-foreground">Pearson</span>
        </h1>

        {/* Subtitle - Mobile First */}
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground mb-6 sm:mb-8 font-light leading-relaxed">
          Sales Leader <span className="text-primary">•</span> NFT Developer <span className="text-primary">•</span> AI Enthusiast
        </p>

        {/* CTA Button - Touch Optimized */}
        <button className="btn-futuristic group min-h-[44px] px-6 sm:px-8 text-sm sm:text-base">
          Explore My Work
          <ArrowRight className="inline-block ml-2 w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      {/* Decorative elements - Mobile optimized */}
      <div className="absolute top-4 sm:top-10 right-4 sm:right-10 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full animate-ping"></div>
      <div className="absolute bottom-16 sm:bottom-20 left-4 sm:left-10 w-1 h-1 bg-tech-cyan rounded-full animate-pulse"></div>
      {!isMobile && (
        <>
          <div className="absolute top-1/4 right-1/4 w-1.5 h-1.5 bg-tech-purple rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-tech-orange rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
        </>
      )}
    </section>
  );
};

export default HeroSection;