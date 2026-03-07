import { Component, ReactNode, ErrorInfo } from 'react';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * HeroErrorBoundary - Lightweight error boundary specifically for the
 * Three.js/GSAP HeroSection. When 3D rendering fails, shows a static
 * gradient fallback instead of crashing the entire page.
 */
class HeroErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.warn('HeroSection 3D rendering failed, showing static fallback', {
      error: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      // Static gradient fallback when 3D rendering fails
      return (
        <div
          className="relative w-full min-h-[60vh] flex items-center justify-center overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--background)) 0%, hsl(220 20% 10%) 50%, hsl(195 100% 15%) 100%)',
          }}
        >
          {/* Subtle static orb effect */}
          <div
            className="absolute w-64 h-64 rounded-full opacity-20 blur-3xl"
            style={{
              background: 'radial-gradient(circle, hsl(195 100% 50%) 0%, transparent 70%)',
            }}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default HeroErrorBoundary;
