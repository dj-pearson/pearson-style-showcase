import { ArrowRight } from 'lucide-react';
import { useRef, useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// Lazy load the 3D orb to prevent render blocking
const Interactive3DOrb = lazy(() => import('./Interactive3DOrb').then(module => ({ default: module.Interactive3DOrb })));

/**
 * Check if animations should be reduced for accessibility or performance
 */
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

const HeroSection = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoadOrb, setShouldLoadOrb] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    // Skip 3D orb if user prefers reduced motion
    if (prefersReducedMotion) {
      return;
    }

    // Use requestIdleCallback to load 3D orb during browser idle time
    let idleCallbackId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const loadOrb = () => {
      setShouldLoadOrb(true);
    };

    if ('requestIdleCallback' in window) {
      idleCallbackId = (window as any).requestIdleCallback(loadOrb, { timeout: 1000 });
    } else {
      timeoutId = setTimeout(loadOrb, 300);
    }

    return () => {
      if (idleCallbackId !== undefined && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [prefersReducedMotion]);
  const nameWrapperRef = useRef<HTMLSpanElement>(null);
  const surnameWrapperRef = useRef<HTMLSpanElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const surnameRef = useRef<HTMLSpanElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);



  useGSAP(() => {
    if (!containerRef.current) return;

    // Respect reduced motion preference - use simpler, faster animations
    if (prefersReducedMotion) {
      // Simple fade-in for reduced motion users
      gsap.set([nameRef.current, surnameRef.current, subtitleRef.current, descRef.current, ctaRef.current], {
        opacity: 1,
      });
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // Initial state - Set perspective on container or wrappers if needed, but keeping it simple on elements
    gsap.set([nameRef.current, surnameRef.current], { perspective: 400 });

    // Animate Name (Entrance)
    tl.from(nameRef.current, {
      y: 100,
      opacity: 0,
      rotationX: -90,
      duration: 1.2,
      ease: "back.out(1.7)"
    })
      .from(surnameRef.current, {
        y: 100,
        opacity: 0,
        rotationX: -90,
        duration: 1.2,
        ease: "back.out(1.7)"
      }, "-=1.0");

    // Animate Subtitle
    tl.from(subtitleRef.current, {
      y: 30,
      opacity: 0,
      duration: 1,
      ease: "power2.out"
    }, "-=0.8");

    // Animate Description
    tl.from(descRef.current, {
      y: 30,
      opacity: 0,
      duration: 1,
      ease: "power2.out"
    }, "-=0.6");

    // Animate CTA
    tl.from(ctaRef.current, {
      scale: 0.5,
      opacity: 0,
      duration: 0.8,
      ease: "elastic.out(1, 0.5)"
    }, "-=0.4");

    // Floating animation for the name (Applied to Wrappers to avoid conflict with Parallax)
    gsap.to([nameWrapperRef.current, surnameWrapperRef.current], {
      y: "-=15", // Increased float range slightly
      duration: 2.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      stagger: 0.2
    });

    // Mouse move parallax effect (Applied to Inner Elements)
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;

      // Calculate position from center
      const xPos = (clientX / innerWidth - 0.5) * 30; // Increased range
      const yPos = (clientY / innerHeight - 0.5) * 30;

      gsap.to(nameRef.current, {
        x: xPos,
        y: yPos,
        rotationY: xPos * 0.5,
        rotationX: -yPos * 0.5,
        duration: 1,
        ease: "power2.out"
      });

      gsap.to(surnameRef.current, {
        x: xPos * 1.2,
        y: yPos * 1.2,
        rotationY: xPos * 0.5,
        rotationX: -yPos * 0.5,
        duration: 1,
        ease: "power2.out"
      });
    };

    const handleMouseLeave = () => {
      // Reset to center when mouse leaves
      gsap.to([nameRef.current, surnameRef.current], {
        x: 0,
        y: 0,
        rotationY: 0,
        rotationX: 0,
        duration: 1.5,
        ease: "elastic.out(1, 0.5)"
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave); // Detect leaving the window

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };

  }, { scope: containerRef, dependencies: [prefersReducedMotion] });

  return (
    <section ref={containerRef} className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-32 sm:pt-40 pb-20 mobile-container bg-transparent">
      {/* Main content - Mobile First Typography */}
      <div className="relative z-10 text-center max-w-[95%] sm:max-w-2xl lg:max-w-4xl mx-auto px-4">
        {/* Main title - Enhanced contrast and readability */}
        {/* Increased margin-bottom significantly to prevent overlap during animations */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-12 sm:mb-16 leading-[1.1] perspective-text py-4">
          <span ref={nameWrapperRef} className="inline-block">
            <span ref={nameRef} style={{
              display: 'inline-block',
              color: '#00d4ff',
              textShadow: '0 0 15px rgba(0, 212, 255, 0.4), 0 2px 5px rgba(0,0,0,0.5)'
            }}>Dan</span>
          </span>
          {' '}
          <span ref={surnameWrapperRef} className="inline-block">
            <span ref={surnameRef} style={{
              display: 'inline-block',
              color: '#ffffff',
              textShadow: '0 0 10px rgba(255, 255, 255, 0.3), 0 2px 5px rgba(0,0,0,0.5)'
            }}>Pearson</span>
          </span>
        </h1>

        {/* Subtitle - Enhanced readability */}
        <div className="relative z-20 mb-6 sm:mb-8">
          <p ref={subtitleRef} className="text-base sm:text-xl md:text-2xl lg:text-3xl text-white font-semibold leading-relaxed" style={{
            textShadow: '2px 2px 4px rgba(0, 0, 0, 1)'
          }}>
            Bridging the gap between sales and technology
          </p>
        </div>

        {/* Value Prop - Enhanced readability */}
        <div ref={descRef} className="relative z-20 mb-10 sm:mb-12 max-w-3xl mx-auto">
          <p className="text-sm sm:text-base md:text-lg text-white/95 font-normal leading-relaxed" style={{
            textShadow: '1px 1px 3px rgba(0, 0, 0, 1)'
          }}>
            With 15+ years closing deals and a passion for AI-powered automation, I build products that actually sell.
            <br />
            <span className="text-primary font-bold" style={{
              textShadow: '0 0 20px rgba(0, 212, 255, 0.8), 1px 1px 3px rgba(0, 0, 0, 1)'
            }}>Currently building 7 SaaS platforms</span> under Pearson Media LLC.
          </p>
        </div>

        {/* CTA Button - Enhanced with strong glow, mobile optimized, fully functional */}
        <Link
          ref={ctaRef}
          to="/projects"
          className="relative z-20 btn-futuristic group mobile-button inline-flex items-center justify-center text-base sm:text-lg font-bold active:scale-95"
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

      {/* Interactive 3D Particle Orb - Drag to spin! (respects reduced motion) */}
      {shouldLoadOrb && !prefersReducedMotion && (
        <div className="absolute inset-0 z-0" style={{ contentVisibility: 'auto', containIntrinsicSize: '100vw 100vh' }}>
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
