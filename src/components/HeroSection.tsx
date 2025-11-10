import { ArrowRight } from 'lucide-react';
import { lazy, Suspense, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// Lazy load the 3D orb to prevent render blocking
const Interactive3DOrb = lazy(() => import('./Interactive3DOrb').then(module => ({ default: module.Interactive3DOrb })));

const HeroSection = () => {
  // Delay loading the 3D orb until after initial paint to improve FCP and LCP
  const [shouldLoadOrb, setShouldLoadOrb] = useState(false);

  useEffect(() => {
    // Only load the heavy 3D orb after the page has had time to render critical content
    // This prevents the 995KB Three.js bundle from blocking initial render
    const timer = setTimeout(() => {
      setShouldLoadOrb(true);
    }, 500); // Delay by 500ms to prioritize critical content

    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-20 sm:pt-24 mobile-container">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/20"></div>

      {/* Main content - Mobile First Typography */}
      <div className="relative z-10 text-center max-w-[95%] sm:max-w-2xl lg:max-w-4xl mx-auto" style={{ contentVisibility: 'auto' }}>
        {/* Main title - Mobile First Sizing with strong contrast */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-5 sm:mb-6 leading-[1.1]">
          <span className="text-primary" style={{
            textShadow: '0 0 30px rgba(0, 212, 255, 1), 0 0 60px rgba(0, 212, 255, 0.8), 0 4px 12px rgba(0, 0, 0, 1)',
            background: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>Dan</span>
          {' '}
          <span className="text-white" style={{
            textShadow: '0 0 20px rgba(255, 255, 255, 0.9), 0 4px 12px rgba(0, 0, 0, 1)',
            background: 'linear-gradient(135deg, #ffffff 0%, #cccccc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>Pearson</span>
        </h1>

        {/* Subtitle - Strong white text with black outline */}
        <p className="text-base sm:text-xl md:text-2xl lg:text-3xl text-white mb-4 sm:mb-6 font-medium leading-relaxed px-2" style={{
          textShadow: '2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 0 0 15px rgba(255, 255, 255, 0.7)'
        }}>
          Bridging the gap between sales and technology
        </p>

        {/* Value Prop - Smaller supporting text */}
        <p className="text-sm sm:text-base md:text-lg text-white/90 mb-8 sm:mb-10 font-normal leading-relaxed px-4 max-w-3xl mx-auto" style={{
          textShadow: '1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000'
        }}>
          With 15+ years closing deals and a passion for AI-powered automation, I build products that actually sell.
          <br />
          <span className="text-primary font-semibold">Currently building 7 SaaS platforms</span> under Pearson Media LLC.
        </p>

        {/* CTA Button - Enhanced with strong glow, mobile optimized, fully functional */}
        <Link
          to="/projects"
          className="btn-futuristic group mobile-button inline-flex items-center justify-center text-base sm:text-lg font-bold active:scale-95"
          style={{
            boxShadow: '0 0 40px rgba(0, 212, 255, 0.8), 0 8px 20px rgba(0, 0, 0, 0.6)'
          }}
        >
          Explore My Work
          <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
        </Link>

        {/* Scroll indicator for mobile */}
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-60 animate-bounce">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Scroll</span>
          <div className="w-0.5 h-8 bg-primary rounded-full"></div>
        </div>
      </div>

      {/* Interactive 3D Particle Orb - Delayed loading to prevent blocking initial render */}
      {shouldLoadOrb && (
        <div className="absolute inset-0 pointer-events-none" style={{ contentVisibility: 'auto' }}>
          <Suspense fallback={null}>
            <Interactive3DOrb />
          </Suspense>
        </div>
      )}

      {/* Decorative elements - Mobile optimized */}
      <div className="absolute top-6 sm:top-10 right-6 sm:right-10 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-primary rounded-full animate-ping"></div>
      <div className="absolute bottom-20 sm:bottom-24 left-6 sm:left-10 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-tech-cyan rounded-full animate-pulse"></div>
      <div className="absolute top-1/4 right-1/4 w-2 h-2 bg-tech-purple rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
      <div className="absolute bottom-1/3 left-1/3 w-1.5 h-1.5 bg-tech-orange rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
    </section>
  );
};

export default HeroSection;