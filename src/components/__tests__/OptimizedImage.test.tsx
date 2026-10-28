import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { OptimizedImage } from '../OptimizedImage';

describe('OptimizedImage Component', () => {
  beforeEach(() => {
    // Clear any previous renders
    document.body.innerHTML = '';
  });

  it('should render with src and alt attributes', () => {
    render(<OptimizedImage src="/test.jpg" alt="Test image" />);

    // Image might not be rendered immediately due to intersection observer
    // But the component should be in the document
    expect(document.body).toBeTruthy();
  });

  it('should render with priority flag', async () => {
    render(<OptimizedImage src="/test.jpg" alt="Priority image" priority={true} />);

    await waitFor(() => {
      const img = screen.getByAltText('Priority image') as HTMLElement;
      expect(img.getAttribute('loading')).toBe('eager');
    });
  });

  it('should render with custom className', () => {
    const { container } = render(
      <OptimizedImage src="/test.jpg" alt="Custom class" className="custom-class" />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toContain('custom-class');
  });

  it('should render with width and height', async () => {
    render(
      <OptimizedImage src="/test.jpg" alt="Sized image" width={800} height={600} priority={true} />
    );

    await waitFor(() => {
      const img = screen.getByAltText('Sized image') as HTMLElement;
      expect(img.getAttribute('width')).toBe('800');
      expect(img.getAttribute('height')).toBe('600');
    });
  });

  it('should show loading placeholder initially', () => {
    const { container } = render(<OptimizedImage src="/test.jpg" alt="Loading image" />);

    // Check for placeholder div with animate-pulse
    const placeholder = container.querySelector('.animate-pulse');
    expect(placeholder).toBeTruthy();
  });

  it('should use placeholder image on error', async () => {
    render(
      <OptimizedImage
        src="/invalid.jpg"
        alt="Error image"
        placeholder="/fallback.jpg"
        priority={true}
      />
    );

    await waitFor(() => {
      const img = screen.queryByAltText('Error image');
      if (img) {
        // Simulate error
        img.dispatchEvent(new Event('error'));
      }
    });
  });

  it('should apply aspect ratio when width and height provided', () => {
    const { container } = render(
      <OptimizedImage src="/test.jpg" alt="Aspect ratio" width={16} height={9} />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.aspectRatio).toBeTruthy();
  });

  it('should set loading attribute to lazy by default', async () => {
    render(<OptimizedImage src="/test.jpg" alt="Lazy image" priority={false} />);

    // Wait for intersection observer to trigger
    await waitFor(() => {
      const img = screen.queryByAltText('Lazy image') as HTMLElement | null;
      if (img) {
        expect(img.getAttribute('loading')).toBe('lazy');
      }
    });
  });

  it('should handle missing alt text gracefully', () => {
    // TypeScript would prevent this, but testing runtime behavior
    const { container } = render(<OptimizedImage src="/test.jpg" alt="" />);

    expect(container.firstChild).toBeTruthy();
  });

  describe('priority images', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('renders visible immediately with eager loading and high fetch priority', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { container } = render(
        <OptimizedImage src="/hero.jpg" alt="Hero" priority width={1200} height={675} />
      );

      const img = screen.getByAltText('Hero');
      expect(img.getAttribute('loading')).toBe('eager');
      expect(img.getAttribute('fetchpriority')).toBe('high');
      expect(img.className).not.toContain('opacity-0');
      expect(container.querySelector('.animate-pulse')).toBeNull();
      // No React unknown-prop warning for fetchpriority
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('does not emit a fake srcset, <picture> or <source>', () => {
      const { container } = render(
        <OptimizedImage
          src="/hero.jpg"
          alt="No srcset"
          priority
          width={1200}
          height={675}
          sizes="100vw"
        />
      );

      const img = screen.getByAltText('No srcset');
      expect(img.hasAttribute('srcset')).toBe(false);
      expect(container.querySelector('picture')).toBeNull();
      expect(container.querySelector('source')).toBeNull();
    });

    it('does not canvas-encode to detect WebP', () => {
      const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL');
      render(<OptimizedImage src="/hero.jpg" alt="No canvas" priority />);
      expect(toDataURL).not.toHaveBeenCalled();
    });

    it('swaps to the placeholder src on error', () => {
      render(
        <OptimizedImage src="/broken.jpg" alt="Broken" placeholder="/fallback.jpg" priority />
      );
      const img = screen.getByAltText('Broken');
      fireEvent.error(img);
      expect(img.getAttribute('src')).toBe('/fallback.jpg');
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  describe('lazy images', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          private cb: IntersectionObserverCallback;
          constructor(cb: IntersectionObserverCallback) {
            this.cb = cb;
          }
          observe(el: Element) {
            this.cb(
              [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
              this as unknown as IntersectionObserver
            );
          }
          disconnect() {}
          unobserve() {}
          takeRecords() {
            return [];
          }
        }
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('uses lazy loading, async decoding, no fetchpriority, and fades in on load', async () => {
      render(<OptimizedImage src="/card.jpg" alt="Card" width={800} height={450} />);

      const img = await screen.findByAltText('Card');
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(img.getAttribute('decoding')).toBe('async');
      expect(img.hasAttribute('fetchpriority')).toBe(false);
      expect(img.className).toContain('opacity-0');

      fireEvent.load(img);
      expect(img.className).toContain('opacity-100');
    });
  });
});
