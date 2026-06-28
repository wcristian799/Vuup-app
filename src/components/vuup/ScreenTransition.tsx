import * as React from "react";
import { motion } from "motion/react";

interface ScreenTransitionProps {
  children: React.ReactNode;
  /** Used as the motion key for AnimatePresence — change to trigger transition */
  motionKey: string;
}

/**
 * ScreenTransition — animated wrapper for tab content.
 * Place multiple ScreenTransition siblings inside a single AnimatePresence
 * (mode="wait") in the parent so only one mounts at a time.
 *
 * Respects prefers-reduced-motion: skips translate when user prefers reduced motion.
 */
export function ScreenTransition({ children, motionKey }: ScreenTransitionProps) {
  const prefersReduced = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  return (
    <motion.div
      key={motionKey}
      initial={{ opacity: 0, y: prefersReduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: prefersReduced ? 0 : -8 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="absolute inset-0 z-10"
    >
      {children}
    </motion.div>
  );
}
