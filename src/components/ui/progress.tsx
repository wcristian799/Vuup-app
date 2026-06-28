import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    variant?: "default" | "gold" | "neon" | "danger";
    size?: "sm" | "md" | "lg";
  }
>(({ className, value, variant = "default", size = "md", ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative w-full overflow-hidden rounded-full bg-surface-3",
      size === "sm" && "h-1",
      size === "md" && "h-1.5",
      size === "lg" && "h-2",
      className,
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        "h-full w-full flex-1 rounded-full transition-all duration-[600ms] ease-out",
        variant === "default" && "bg-gradient-to-r from-electric to-electric/80",
        variant === "gold" && "bg-gradient-to-r from-gold to-gold/80",
        variant === "neon" && "bg-gradient-to-r from-neon to-neon/80",
        variant === "danger" && "bg-gradient-to-r from-danger to-danger/80",
      )}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
