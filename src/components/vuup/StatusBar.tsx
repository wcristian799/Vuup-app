import * as React from "react";

interface StatusBarProps {
  className?: string;
}

/**
 * StatusBar — top bar simulating mobile system UI
 * Decorative only; aria-hidden
 */
export function StatusBar({ className }: StatusBarProps) {
  const [time, setTime] = React.useState(() => {
    const now = new Date();
    return now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  });

  React.useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    };
    // Update on the next minute boundary
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    const timeout = setTimeout(() => {
      update();
      const interval = setInterval(update, 60_000);
      return () => clearInterval(interval);
    }, msToNextMinute);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`flex h-8 items-center justify-between px-4 ${className ?? ""}`}
    >
      <span className="font-display text-sm font-bold text-electric tracking-wide">VUUP</span>
      <span className="font-mono text-xs text-muted-foreground">{time}</span>
    </div>
  );
}
