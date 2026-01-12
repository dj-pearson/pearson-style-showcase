import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const iconButtonVariants = cva(
  "inline-flex items-center justify-center rounded-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 w-10",
        sm: "h-9 w-9",
        lg: "h-11 w-11",
        // 44px minimum touch target for accessibility
        touch: "h-11 w-11 min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "default",
    },
  }
)

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  /** Required accessible label for the icon button */
  "aria-label": string;
  /** Whether to render as a child component */
  asChild?: boolean;
}

/**
 * IconButton - Accessible icon-only button component
 *
 * IMPORTANT: aria-label is REQUIRED for accessibility.
 * This ensures screen readers can announce the button's purpose.
 *
 * @example
 * <IconButton aria-label="Close menu" onClick={handleClose}>
 *   <X className="h-4 w-4" />
 * </IconButton>
 *
 * @example
 * <IconButton aria-label="Delete item" variant="destructive" size="touch">
 *   <Trash className="h-4 w-4" />
 * </IconButton>
 */
const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, asChild = false, "aria-label": ariaLabel, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    // Development warning for missing aria-label (should never happen due to TypeScript)
    if (process.env.NODE_ENV === 'development' && !ariaLabel) {
      console.warn(
        'IconButton: aria-label is required for accessibility. ' +
        'Please provide a descriptive label for screen readers.'
      )
    }

    return (
      <Comp
        className={cn(iconButtonVariants({ variant, size, className }))}
        ref={ref}
        aria-label={ariaLabel}
        type="button"
        {...props}
      >
        {/* Mark icon as decorative since button has aria-label */}
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement, {
              'aria-hidden': true,
            })
          }
          return child
        })}
      </Comp>
    )
  }
)
IconButton.displayName = "IconButton"

export { IconButton, iconButtonVariants }
