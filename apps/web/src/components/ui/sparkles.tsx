"use client";

import React, { useId, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SparklesCoreProps {
  id?: string;
  className?: string;
  background?: string;
  minSize?: number;
  maxSize?: number;
  speed?: number;
  particleColor?: string;
  particleDensity?: number;
}

export const SparklesCore = ({
  id,
  className,
  background = "transparent",
  minSize = 0.4,
  maxSize = 1,
  speed = 1,
  particleColor = "#FFF",
  particleDensity = 100,
}: SparklesCoreProps) => {
  const generatedId = useId();
  const sparkleId = id || generatedId;

  const particles = useMemo(
    () => {
      const seeded = (index: number, salt: number) => {
        const base = sparkleId.length * 31 + index * 17 + salt * 13;
        const value = Math.sin(base) * 10000;
        return value - Math.floor(value);
      };

      return (
      Array.from({ length: particleDensity }, (_, i) => ({
        id: i,
        x: seeded(i, 1) * 100,
        y: seeded(i, 2) * 100,
        size: seeded(i, 3) * (maxSize - minSize) + minSize,
        duration: (seeded(i, 4) * 2 + 1) / speed,
        delay: seeded(i, 5) * 2,
      }))
      );
    },
    [particleDensity, minSize, maxSize, speed, sparkleId]
  );

  return (
    <div
      className={cn("h-full w-full relative overflow-hidden", className)}
      style={{ background }}
    >
      {particles.map((particle) => (
        <motion.span
          key={`${sparkleId}-${particle.id}`}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            background: particleColor,
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

interface SparklesTitleProps {
  children: React.ReactNode;
  className?: string;
  sparklesClassName?: string;
}

export const SparklesTitle = ({
  children,
  className,
  sparklesClassName,
}: SparklesTitleProps) => {
  return (
    <div className={cn("relative inline-block", className)}>
      <div className="absolute inset-0 -z-10">
        <SparklesCore
          className={cn("w-full h-full", sparklesClassName)}
          particleColor="#ffffff"
          particleDensity={50}
          minSize={0.5}
          maxSize={1.5}
        />
      </div>
      {children}
    </div>
  );
};
