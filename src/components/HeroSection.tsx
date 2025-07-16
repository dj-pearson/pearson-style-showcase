import { ArrowRight } from 'lucide-react';
import { Interactive3DOrb } from './Interactive3DOrb';

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16 sm:pt-20">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/20"></div>

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

      {/* Interactive 3D Particle Orb */}
      <div className="absolute inset-0 pointer-events-none">
        <Interactive3DOrb />
      </div>

      {/* Decorative elements - Mobile optimized */}
      <div className="absolute top-4 sm:top-10 right-4 sm:right-10 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full animate-ping"></div>
      <div className="absolute bottom-16 sm:bottom-20 left-4 sm:left-10 w-1 h-1 bg-tech-cyan rounded-full animate-pulse"></div>
      <div className="absolute top-1/4 right-1/4 w-1.5 h-1.5 bg-tech-purple rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
      <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-tech-orange rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
    </section>
  );
};

export default HeroSection;