"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  gradient?: string;
}

export const GradientText = ({
  children,
  className,
  gradient = "from-purple-500 via-violet-500 to-pink-500",
}: GradientTextProps) => {
  return (
    <motion.span
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "bg-gradient-to-r bg-clip-text text-transparent",
        gradient,
        className
      )}
    >
      {children}
    </motion.span>
  );
};

interface FlickerTextProps {
  text: string;
  className?: string;
}

export const FlickerText = ({ text, className }: FlickerTextProps) => {
  return (
    <motion.h1
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "text-6xl md:text-8xl font-bold tracking-tight",
        className
      )}
    >
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.2,
            delay: i * 0.05,
          }}
          className="inline-block bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent"
          style={{
            textShadow: "0 0 40px rgba(255,255,255,0.3)",
          }}
        >
          {char}
        </motion.span>
      ))}
    </motion.h1>
  );
};
