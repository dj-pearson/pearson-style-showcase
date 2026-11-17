import { ArrowRight } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { useAnalytics } from '@/components/Analytics';
import {
  HERO_CLASSES,
  HERO_COPY,
  HERO_SHADOWS,
  PRERENDERED_HERO_ATTR,
} from '@/lib/prerender-classes';

/**
 * True while the hero scripts/prerender.mjs wrote into #root is still on
 * screen. main.tsx waits for this chunk before its first render, so the
 * static copy is still in the DOM when the module evaluates. Read once: a
 * later client-side visit to / gets the full entrance animation.
 */
let prerenderedHeroPending =
  typeof document !== 'undefined' && document.querySelector(`[${PRERENDERED_HERO_ATTR}]`) !== null;

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
  const osReducedMotion = usePrefersReducedMotion();
  const { preferences } = useAccessibility();
  // Honor BOTH the OS-level setting and the in-app "Reduce Motion" widget toggle.
  const prefersReducedMotion = osReducedMotion || preferences.reducedMotion;
  // Note: 3D Orb is now rendered in Index.tsx as a fixed background
  // to avoid duplicate WebGL contexts and improve performance
  const nameWrapperRef = useRef<HTMLSpanElement>(null);
  const surnameWrapperRef = useRef<HTMLSpanElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const surnameRef = useRef<HTMLSpanElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const { trackCTA } = useAnalytics();
  // When the prerendered hero already painted, the entrance animation would
  // blank the name and slide it back in over text the visitor is reading.
  // Skip it; the float and the parallax still run.
  const [skipEntrance] = useState(() => prerenderedHeroPending);
  useEffect(() => {
    prerenderedHeroPending = false;
  }, []);

  useGSAP(
    () => {
      if (!containerRef.current) return;

      // Respect reduced motion preference - use simpler, faster animations
      if (prefersReducedMotion) {
        // Simple fade-in for reduced motion users
        gsap.set(
          [
            nameRef.current,
            surnameRef.current,
            subtitleRef.current,
            descRef.current,
            ctaRef.current,
          ],
          {
            opacity: 1,
          }
        );
        return;
      }

      const tl = skipEntrance ? null : gsap.timeline({ defaults: { ease: 'power3.out' } });

      if (tl) {
        // Initial state - Set perspective on container or wrappers if needed, but keeping it simple on elements
        gsap.set([nameRef.current, surnameRef.current], { perspective: 400 });

        // Animate Name (Entrance)
        tl.from(nameRef.current, {
          y: 100,
          opacity: 0,
          rotationX: -90,
          duration: 1.2,
          ease: 'back.out(1.7)',
        }).from(
          surnameRef.current,
          {
            y: 100,
            opacity: 0,
            rotationX: -90,
            duration: 1.2,
            ease: 'back.out(1.7)',
          },
          '-=1.0'
        );

        // Animate Subtitle
        tl.from(
          subtitleRef.current,
          {
            y: 30,
            opacity: 0,
            duration: 1,
            ease: 'power2.out',
          },
          '-=0.8'
        );

        // Animate Description
        //
        // Slide only, no opacity. This paragraph is the page's LCP element, and
        // it sits one second deep in the timeline: fading it from 0 held the
        // largest text on the homepage invisible until ~1s after hydration and
        // pushed LCP to 5.3s against 3.4s for pages with no hero animation at
        // all. It also meant the prerendered copy, already painted, blanked and
        // faded back in on hydration. Sliding an element that is already visible
        // reads the same and paints immediately.
        tl.from(
          descRef.current,
          {
            y: 30,
            duration: 1,
            ease: 'power2.out',
          },
          '-=0.6'
        );

        // Animate CTA
        tl.from(
          ctaRef.current,
          {
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out',
          },
          '-=0.4'
        );
      }

      // Floating animation for the name (Applied to Wrappers to avoid conflict with Parallax)
      const floatingTween = gsap.to([nameWrapperRef.current, surnameWrapperRef.current], {
        y: '-=15',
        duration: 2.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: 0.2,
      });

      // The float repeats forever, so pause it while the hero is off screen
      // (scrolled past, or a background tab on mobile) and resume on return.
      // Reduced-motion users never get here: the early return above skips it.
      let visibilityObserver: IntersectionObserver | null = null;
      if (typeof IntersectionObserver !== 'undefined') {
        visibilityObserver = new IntersectionObserver(
          ([entry]) => {
            if (entry?.isIntersecting) floatingTween.resume();
            else floatingTween.pause();
          },
          { threshold: 0 }
        );
        visibilityObserver.observe(containerRef.current);
      }

      // will-change hints so the GPU promotes the animated name/surname to
      // their own layers; cleared on cleanup to free GPU memory.
      gsap.set([nameRef.current, surnameRef.current], { willChange: 'transform' });

      // Skip the mouse-move parallax entirely on touch-only devices (no hover /
      // coarse pointer): the listeners and rAF work would never produce a
      // visible effect and just waste cycles on phones.
      const isTouchOnlyDevice =
        typeof window !== 'undefined' &&
        (window.matchMedia?.('(hover: none) and (pointer: coarse)').matches ||
          ('ontouchstart' in window && !window.matchMedia?.('(pointer: fine)').matches));

      // Mouse move parallax effect (Applied to Inner Elements)
      // Throttled using requestAnimationFrame for optimal performance (60fps max)
      let rafId: number | null = null;
      let lastMouseX = 0;
      let lastMouseY = 0;

      const updateParallax = () => {
        if (!containerRef.current) return;
        const { innerWidth, innerHeight } = window;

        const xPos = (lastMouseX / innerWidth - 0.5) * 30;
        const yPos = (lastMouseY / innerHeight - 0.5) * 30;

        gsap.to(nameRef.current, {
          x: xPos,
          y: yPos,
          rotationY: xPos * 0.5,
          rotationX: -yPos * 0.5,
          duration: 1,
          ease: 'power2.out',
        });

        gsap.to(surnameRef.current, {
          x: xPos * 1.2,
          y: yPos * 1.2,
          rotationY: xPos * 0.5,
          rotationX: -yPos * 0.5,
          duration: 1,
          ease: 'power2.out',
        });

        rafId = null;
      };

      const handleMouseMove = (e: MouseEvent) => {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        if (rafId === null) {
          rafId = requestAnimationFrame(updateParallax);
        }
      };

      const handleMouseLeave = () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        gsap.to([nameRef.current, surnameRef.current], {
          x: 0,
          y: 0,
          rotationY: 0,
          rotationX: 0,
          duration: 1.2,
          // Smooth deceleration rather than an elastic overshoot — real objects
          // settle, they do not spring back (see the craft floor in CLAUDE.md).
          ease: 'expo.out',
        });
      };

      if (!isTouchOnlyDevice) {
        window.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseleave', handleMouseLeave);
      }

      return () => {
        // Kill all GSAP animations to prevent memory leaks
        tl?.kill();
        visibilityObserver?.disconnect();
        floatingTween.kill();
        gsap.killTweensOf([
          nameRef.current,
          surnameRef.current,
          nameWrapperRef.current,
          surnameWrapperRef.current,
        ]);
        // Release GPU layer promotion.
        gsap.set([nameRef.current, surnameRef.current], { willChange: 'auto' });
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        if (!isTouchOnlyDevice) {
          window.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseleave', handleMouseLeave);
        }
      };
    },
    { scope: containerRef, dependencies: [prefersReducedMotion, skipEntrance] }
  );

  return (
    <section ref={containerRef} className={HERO_CLASSES.section}>
      {/* Main content - Mobile First Typography */}
      <div className={HERO_CLASSES.content}>
        {/* Main title - Enhanced contrast and readability */}
        {/* Increased margin-bottom significantly to prevent overlap during animations */}
        <h1 className={HERO_CLASSES.title}>
          <span ref={nameWrapperRef} className={HERO_CLASSES.nameWrapper}>
            <span
              ref={nameRef}
              className={HERO_CLASSES.firstName}
              style={{ textShadow: HERO_SHADOWS.firstName }}
            >
              {HERO_COPY.firstName}
            </span>
          </span>{' '}
          <span ref={surnameWrapperRef} className={HERO_CLASSES.nameWrapper}>
            <span
              ref={surnameRef}
              className={HERO_CLASSES.lastName}
              style={{ textShadow: HERO_SHADOWS.lastName }}
            >
              {HERO_COPY.lastName}
            </span>
          </span>
        </h1>

        {/* Subtitle - Enhanced readability */}
        <div className={HERO_CLASSES.subtitleWrap}>
          <p
            ref={subtitleRef}
            className={HERO_CLASSES.subtitle}
            style={{ textShadow: HERO_SHADOWS.subtitle }}
          >
            {HERO_COPY.subtitle}
          </p>
        </div>

        {/* Value Prop - Enhanced readability */}
        <div ref={descRef} className={HERO_CLASSES.descWrap}>
          <p className={HERO_CLASSES.desc} style={{ textShadow: HERO_SHADOWS.desc }}>
            {HERO_COPY.desc}
            <br />
            <span
              className={HERO_CLASSES.descEmphasis}
              style={{ textShadow: HERO_SHADOWS.descEmphasis }}
            >
              {HERO_COPY.descEmphasis}
            </span>
          </p>
        </div>

        {/* CTAs: the audit is the primary action; the explainer is secondary */}
        <div ref={ctaRef} className={HERO_CLASSES.ctaRow}>
          <Link
            to={HERO_COPY.ctaPrimary.href}
            onClick={() => trackCTA(HERO_COPY.ctaPrimary.label, 'Hero')}
            className={HERO_CLASSES.ctaPrimary}
            style={{ boxShadow: HERO_SHADOWS.ctaPrimary }}
          >
            {HERO_COPY.ctaPrimary.label}
            <ArrowRight className={HERO_CLASSES.ctaPrimaryIcon} />
          </Link>
          <Link
            to={HERO_COPY.ctaSecondary.href}
            onClick={() => trackCTA(HERO_COPY.ctaSecondary.label, 'Hero')}
            className={HERO_CLASSES.ctaSecondary}
          >
            {HERO_COPY.ctaSecondary.label}
          </Link>
        </div>

        {/* Scroll indicator for mobile */}
        <div className={HERO_CLASSES.scrollHint}>
          <span className={HERO_CLASSES.scrollHintLabel}>Scroll</span>
          <div className={HERO_CLASSES.scrollHintBar}></div>
        </div>
      </div>

      {/* 3D Orb is rendered in Index.tsx as a fixed background for better performance */}

      {/* Decorative elements - Mobile optimized */}
      {HERO_CLASSES.dots.map((className, index) => (
        <div
          key={className}
          className={className}
          style={
            HERO_CLASSES.dotDelays[index]
              ? { animationDelay: HERO_CLASSES.dotDelays[index] }
              : undefined
          }
        ></div>
      ))}
    </section>
  );
};

export default HeroSection;
