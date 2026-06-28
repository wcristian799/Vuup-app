import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & {
    size?: "sm" | "md" | "lg" | "xl";
    ring?: "none" | "electric" | "gold" | "neon";
  }
>(({ className, size = "md", ring = "none", ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex shrink-0 overflow-hidden rounded-full",
      size === "sm" && "h-8 w-8",
      size === "md" && "h-10 w-10",
      size === "lg" && "h-14 w-14",
      size === "xl" && "h-20 w-20",
      ring === "electric" && "ring-2 ring-electric ring-offset-1 ring-offset-background",
      ring === "gold" &&
        "ring-2 ring-gold ring-offset-1 ring-offset-background shadow-[0_0_8px_oklch(0.84_0.16_88/0.5)]",
      ring === "neon" && "ring-2 ring-neon ring-offset-1 ring-offset-background",
      className,
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> & {
    variant?: "default" | "driver" | "patron";
  }
>(({ className, variant = "default", ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full text-sm font-semibold",
      variant === "default" && "bg-surface-3 text-foreground",
      variant === "driver" && "bg-electric/20 text-electric",
      variant === "patron" && "bg-gold/20 text-gold",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
