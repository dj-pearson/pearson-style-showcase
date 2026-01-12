# Accessibility Guide

This document outlines the accessibility features, standards, and best practices implemented in the Dan Pearson Portfolio website to ensure ADA compliance and WCAG 2.1 Level AA conformance.

## Table of Contents

1. [Overview](#overview)
2. [WCAG 2.1 Compliance](#wcag-21-compliance)
3. [Implemented Features](#implemented-features)
4. [Component Guidelines](#component-guidelines)
5. [Testing](#testing)
6. [Resources](#resources)

---

## Overview

This website is designed to be accessible to users with disabilities, including those who:
- Use screen readers (NVDA, JAWS, VoiceOver, TalkBack)
- Navigate via keyboard only
- Have low vision or color blindness
- Have cognitive disabilities
- Are sensitive to motion/animations

### Key Principles (POUR)

1. **Perceivable** - Information must be presentable in ways users can perceive
2. **Operable** - Interface components must be operable by all users
3. **Understandable** - Information and UI operation must be understandable
4. **Robust** - Content must be robust enough for various assistive technologies

---

## WCAG 2.1 Compliance

### Level AA Requirements Met

| Criterion | Status | Implementation |
|-----------|--------|----------------|
| 1.1.1 Non-text Content | ✅ | Alt text on all images, aria-labels on icons |
| 1.3.1 Info and Relationships | ✅ | Semantic HTML, proper heading hierarchy |
| 1.3.2 Meaningful Sequence | ✅ | Logical DOM order, proper tab sequence |
| 1.3.3 Sensory Characteristics | ✅ | Instructions don't rely solely on color/shape |
| 1.4.1 Use of Color | ✅ | Color + text/icons for status indicators |
| 1.4.3 Contrast (Minimum) | ✅ | 4.5:1 for normal text, 3:1 for large text |
| 1.4.4 Resize Text | ✅ | Text resizable to 200% without loss |
| 1.4.10 Reflow | ✅ | Content reflows at 320px width |
| 1.4.11 Non-text Contrast | ✅ | 3:1 contrast for UI components |
| 2.1.1 Keyboard | ✅ | All functionality via keyboard |
| 2.1.2 No Keyboard Trap | ✅ | Focus can always escape |
| 2.1.4 Character Key Shortcuts | ✅ | Shortcuts use modifier keys |
| 2.4.1 Bypass Blocks | ✅ | Skip to main content link |
| 2.4.2 Page Titled | ✅ | Descriptive page titles |
| 2.4.3 Focus Order | ✅ | Logical focus sequence |
| 2.4.4 Link Purpose | ✅ | Clear link text |
| 2.4.6 Headings and Labels | ✅ | Descriptive headings |
| 2.4.7 Focus Visible | ✅ | 2px cyan outline on all elements |
| 2.5.5 Target Size | ✅ | 44x44px minimum touch targets |
| 3.1.1 Language of Page | ✅ | `lang="en"` on html element |
| 3.2.1 On Focus | ✅ | No unexpected context changes |
| 3.2.2 On Input | ✅ | Form changes don't auto-submit |
| 3.3.1 Error Identification | ✅ | Errors clearly identified |
| 3.3.2 Labels or Instructions | ✅ | Form fields labeled |
| 3.3.3 Error Suggestion | ✅ | Helpful error messages |
| 4.1.1 Parsing | ✅ | Valid HTML |
| 4.1.2 Name, Role, Value | ✅ | ARIA attributes on custom controls |
| 4.1.3 Status Messages | ✅ | Live regions for dynamic content |

---

## Implemented Features

### 1. Skip Link

Located at the top of every page, allows keyboard users to skip navigation.

```html
<a href="#main-content" class="skip-to-content">
  Skip to main content
</a>
```

### 2. Focus Management

Global focus styles defined in `index.css`:

```css
*:focus-visible {
  outline: 2px solid hsl(195 100% 50%);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px hsl(195 100% 50% / 0.2);
}
```

### 3. Screen Reader Support

- **VisuallyHidden component** (`src/components/ui/visually-hidden.tsx`)
- **LiveRegion component** (`src/components/ui/live-region.tsx`)
- **sr-only class** for screen reader-only content

### 4. Accessible Form Errors

Form errors use `role="alert"` and `aria-live="assertive"`:

```tsx
<p role="alert" aria-live="assertive" aria-atomic="true">
  {errorMessage}
</p>
```

### 5. External Links

External links indicate they open in new tabs:

```tsx
import ExternalLink from '@/components/ui/external-link';

<ExternalLink href="https://example.com">
  Visit Example
</ExternalLink>
// Renders: "Visit Example ↗ (opens in new tab)"
```

### 6. Icon Buttons

Use `IconButton` component for accessible icon-only buttons:

```tsx
import { IconButton } from '@/components/ui/icon-button';

<IconButton aria-label="Close menu">
  <X className="h-4 w-4" />
</IconButton>
```

### 7. Data Tables

Use accessible table components for data tables:

```tsx
import {
  AccessibleTable,
  AccessibleTableHeader,
  AccessibleTableBody,
  AccessibleTableRow,
  AccessibleTableHead,
  AccessibleTableCell
} from '@/components/ui/accessible-table';

<AccessibleTable caption="User accounts">
  <AccessibleTableHeader>
    <AccessibleTableRow>
      <AccessibleTableHead scope="col">Name</AccessibleTableHead>
      <AccessibleTableHead scope="col" sortDirection="ascending">Date</AccessibleTableHead>
    </AccessibleTableRow>
  </AccessibleTableHeader>
  <AccessibleTableBody>
    <AccessibleTableRow>
      <AccessibleTableCell isRowHeader>John Doe</AccessibleTableCell>
      <AccessibleTableCell>Jan 1, 2024</AccessibleTableCell>
    </AccessibleTableRow>
  </AccessibleTableBody>
</AccessibleTable>
```

### 8. Reduced Motion Support

Animations respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

In components:

```tsx
import { usePrefersReducedMotion } from '@/hooks/useAccessibility';

const MyComponent = () => {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className={prefersReducedMotion ? '' : 'animate-bounce'}>
      Content
    </div>
  );
};
```

### 9. High Contrast Mode Support

Windows High Contrast Mode is supported:

```css
@media (forced-colors: active) {
  .btn-futuristic {
    border: 2px solid currentColor;
  }
}
```

---

## Component Guidelines

### Buttons

```tsx
// Standard button with text - accessible by default
<Button>Submit Form</Button>

// Icon-only button - MUST use IconButton or aria-label
<IconButton aria-label="Delete item">
  <Trash className="h-4 w-4" />
</IconButton>

// Button with icon and text - icon should be decorative
<Button>
  <Save className="h-4 w-4" aria-hidden="true" />
  Save Changes
</Button>
```

### Images

```tsx
// Meaningful images - provide descriptive alt text
<img src="/photo.jpg" alt="Dan Pearson speaking at tech conference" />

// Decorative images - use empty alt or aria-hidden
<img src="/decoration.svg" alt="" aria-hidden="true" />

// Use OptimizedImage component for automatic handling
<OptimizedImage
  src="/photo.jpg"
  alt="Product screenshot showing dashboard"
/>
```

### Forms

```tsx
// Always associate labels with inputs
<FormItem>
  <FormLabel htmlFor="email">Email Address</FormLabel>
  <FormControl>
    <Input id="email" type="email" aria-describedby="email-hint" />
  </FormControl>
  <FormDescription id="email-hint">
    We'll never share your email.
  </FormDescription>
  <FormMessage /> {/* Automatically uses role="alert" */}
</FormItem>

// Required fields
<FormLabel className="form-label-required">Name</FormLabel>
```

### Links

```tsx
// Internal links - standard Link component
<Link to="/about">About Us</Link>

// External links - use ExternalLink component
<ExternalLink href="https://github.com">
  GitHub Repository
</ExternalLink>

// Links that look like buttons
<Button asChild>
  <Link to="/signup">Sign Up</Link>
</Button>
```

### Dialogs/Modals

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open Settings</Button>
  </DialogTrigger>
  <DialogContent closeButtonLabel="Close settings dialog">
    <DialogHeader>
      <DialogTitle>Settings</DialogTitle>
      <DialogDescription>
        Manage your account settings and preferences.
      </DialogDescription>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

### Live Announcements

```tsx
import LiveRegion, { AlertRegion } from '@/components/ui/live-region';

// Status updates (polite)
<LiveRegion message={`${results.length} results found`} />

// Error messages (assertive)
<AlertRegion message={error} />

// Using hook for programmatic announcements
const { announce } = useAccessibility();
announce('Item deleted successfully', 'polite');
```

---

## Testing

### Automated Testing

Run accessibility tests:

```bash
# Run all tests including a11y
npm test

# Run specific a11y tests
npm test -- accessibility
```

### Manual Testing Checklist

- [ ] Navigate entire site using keyboard only
- [ ] Test with screen reader (NVDA, VoiceOver)
- [ ] Test at 200% zoom
- [ ] Test at 400% zoom
- [ ] Test with Windows High Contrast mode
- [ ] Test with `prefers-reduced-motion: reduce`
- [ ] Test on mobile with VoiceOver/TalkBack
- [ ] Verify color contrast ratios
- [ ] Check focus visibility on all interactive elements

### Browser Extensions

- **axe DevTools** - Automated accessibility testing
- **WAVE** - Web Accessibility Evaluation Tool
- **Lighthouse** - Built into Chrome DevTools

### Screen Reader Testing

| Screen Reader | Browser | Platform |
|---------------|---------|----------|
| NVDA | Firefox/Chrome | Windows |
| JAWS | Chrome | Windows |
| VoiceOver | Safari | macOS/iOS |
| TalkBack | Chrome | Android |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move to next focusable element |
| Shift+Tab | Move to previous focusable element |
| Enter/Space | Activate button/link |
| Escape | Close modal/menu |
| Arrow keys | Navigate within components |
| Home/End | Jump to first/last item |

---

## Resources

### Standards & Guidelines

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [ADA.gov](https://www.ada.gov/)

### Tools

- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools](https://www.deque.com/axe/)
- [NVDA Screen Reader](https://www.nvaccess.org/)

### Internal Resources

- [Accessibility Statement](/accessibility)
- [Component Documentation](/src/components/ui/)
- [Accessibility Hook](/src/hooks/useAccessibility.ts)

---

## Contact

For accessibility concerns or to report barriers:

- **Email**: accessibility@danpearson.net
- **Contact Form**: [/connect](/connect)

We respond to accessibility feedback within 5 business days.
