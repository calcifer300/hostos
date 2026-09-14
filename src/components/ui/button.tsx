import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-200 ease-[var(--ease-out-expo)] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-foreground shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_8px_24px_-12px_var(--accent)] hover:brightness-110",
        gradient:
          "bg-[linear-gradient(120deg,var(--accent),var(--accent-2))] text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_12px_32px_-12px_var(--accent)] hover:brightness-110",
        secondary: "border border-border bg-card text-foreground hover:border-border-strong hover:bg-muted/60",
        ghost: "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        outline: "border border-border bg-transparent text-foreground hover:bg-muted/60",
        danger: "bg-danger text-white hover:brightness-110",
        link: "h-auto p-0 text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-11 px-6 text-[15px] rounded-xl",
        xl: "h-12 px-7 text-[15px] rounded-full",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
      pill: {
        true: "rounded-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
      pill: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, pill, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, pill, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {/* Slot requires exactly one child, so the spinner only exists on real buttons. */}
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
