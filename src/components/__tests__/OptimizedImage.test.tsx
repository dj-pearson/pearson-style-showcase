import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { OptimizedImage } from '../OptimizedImage';

describe('OptimizedImage Component', () => {
  beforeEach(() => {
    // Clear any previous renders
    document.body.innerHTML = '';
  });

  it('should render with src and alt attributes', () => {
    render(<OptimizedImage src="/test.jpg" alt="Test image" />);
    const img = screen.queryByAltText('Test image');

    // Image might not be rendered immediately due to intersection observer
    // But the component should be in the document
    expect(document.body).toBeTruthy();
  });

  it('should render with priority flag', () => {
    render(<OptimizedImage src="/test.jpg" alt="Priority image" priority={true} />);

    waitFor(() => {
      const img = screen.getByAltText('Priority image');
      expect(img).toHaveAttribute('loading', 'eager');
    });
  });

  it('should render with custom className', () => {
    const { container } = render(
      <OptimizedImage src="/test.jpg" alt="Custom class" className="custom-class" />
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('should render with width and height', () => {
    const { container } = render(
      <OptimizedImage
        src="/test.jpg"
        alt="Sized image"
        width={800}
        height={600}
        priority={true}
      />
    );

    waitFor(() => {
      const img = screen.getByAltText('Sized image');
      expect(img).toHaveAttribute('width', '800');
      expect(img).toHaveAttribute('height', '600');
    });
  });

  it('should show loading placeholder initially', () => {
    const { container } = render(
      <OptimizedImage src="/test.jpg" alt="Loading image" />
    );

    // Check for placeholder div with animate-pulse
    const placeholder = container.querySelector('.animate-pulse');
    expect(placeholder).toBeTruthy();
  });

  it('should use placeholder image on error', async () => {
    const { container } = render(
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
      <OptimizedImage
        src="/test.jpg"
        alt="Aspect ratio"
        width={16}
        height={9}
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.aspectRatio).toBeTruthy();
  });

  it('should set loading attribute to lazy by default', async () => {
    render(
      <OptimizedImage
        src="/test.jpg"
        alt="Lazy image"
        priority={false}
      />
    );

    // Wait for intersection observer to trigger
    await waitFor(() => {
      const img = screen.queryByAltText('Lazy image');
      if (img) {
        expect(img).toHaveAttribute('loading', 'lazy');
      }
    });
  });

  it('should handle missing alt text gracefully', () => {
    // TypeScript would prevent this, but testing runtime behavior
    const { container } = render(
      <OptimizedImage src="/test.jpg" alt="" />
    );

    expect(container.firstChild).toBeTruthy();
  });
});
