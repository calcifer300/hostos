import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-2xl border bg-card text-card-foreground", {
  variants: {
    variant: {
      default: "border-border shadow-[var(--shadow-card)]",
      elevated: "border-border shadow-[var(--shadow-elevated)]",
      glass: "glass-panel",
      outline: "border-border bg-transparent",
      glow: "border-transparent shadow-[var(--shadow-glow)]",
      dashed: "border-dashed border-border bg-transparent",
    },
    interactive: {
      true: "card-interactive cursor-pointer",
      false: "",
    },
    padding: {
      none: "",
      sm: "p-4",
      md: "p-5",
      lg: "p-6 md:p-7",
    },
  },
  defaultVariants: { variant: "default", interactive: false, padding: "none" },
});

export interface CardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant, interactive, padding, ...props }, ref) => (
  <div ref={ref} className={cn(cardVariants({ variant, interactive, padding }), className)} {...props} />
));
Card.displayName = "Card";

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start justify-between gap-3 px-5 pt-5 pb-3", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[13.5px] font-semibold tracking-tight", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[12.5px] leading-relaxed text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-2 border-t border-border px-5 py-3.5", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants };
