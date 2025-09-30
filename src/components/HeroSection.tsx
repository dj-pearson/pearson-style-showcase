import { ArrowRight } from 'lucide-react';
import { lazy, Suspense } from 'react';

// Lazy load the 3D orb to prevent render blocking
const Interactive3DOrb = lazy(() => import('./Interactive3DOrb').then(module => ({ default: module.Interactive3DOrb })));

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16 sm:pt-20">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/20"></div>

      {/* Main content - Mobile First Typography */}
      <div className="relative z-10 text-center max-w-sm sm:max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6" style={{ contentVisibility: 'auto' }}>
        {/* Main title - Mobile First Sizing with strong contrast */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-4 sm:mb-6 leading-tight">
          <span className="text-primary" style={{
            textShadow: '0 0 30px rgba(0, 212, 255, 1), 0 0 60px rgba(0, 212, 255, 0.8), 0 4px 12px rgba(0, 0, 0, 1)',
            background: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>Dan</span>
          <span className="text-white" style={{
            textShadow: '0 0 20px rgba(255, 255, 255, 0.9), 0 4px 12px rgba(0, 0, 0, 1)',
            background: 'linear-gradient(135deg, #ffffff 0%, #cccccc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>Pearson</span>
        </h1>

        {/* Subtitle - Strong white text with black outline */}
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white mb-6 sm:mb-8 font-medium leading-relaxed" style={{
          textShadow: '2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 0 0 15px rgba(255, 255, 255, 0.7)'
        }}>
          Sales Leader <span className="text-primary font-bold" style={{
            textShadow: '0 0 20px rgba(0, 212, 255, 1), 2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000'
          }}>•</span> NFT Developer <span className="text-primary font-bold" style={{
            textShadow: '0 0 20px rgba(0, 212, 255, 1), 2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000'
          }}>•</span> AI Enthusiast
        </p>

        {/* CTA Button - Enhanced with strong glow */}
        <button className="btn-futuristic group min-h-[44px] px-6 sm:px-8 text-sm sm:text-base" style={{
          boxShadow: '0 0 40px rgba(0, 212, 255, 0.8), 0 8px 20px rgba(0, 0, 0, 0.6)'
        }}>
          Explore My Work
          <ArrowRight className="inline-block ml-2 w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      {/* Interactive 3D Particle Orb - Lazy loaded to prevent render blocking */}
      <div className="absolute inset-0 pointer-events-none" style={{ contentVisibility: 'auto' }}>
        <Suspense fallback={null}>
          <Interactive3DOrb />
        </Suspense>
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