'use client';

import type { CSSProperties, ReactNode } from "react";

import "./GradientText.css";

interface GradientTextProps {
  children?: ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  showBorder?: boolean;
}

export default function GradientText({
  children,
  className = "",
  colors = ["#40ffaa", "#4079ff", "#40ffaa", "#4079ff", "#40ffaa"],
  animationSpeed = 8,
  showBorder = false,
}: GradientTextProps) {
  const gradientStyle: CSSProperties = {
    backgroundImage: `linear-gradient(to right, ${colors.join(", ")})`,
    animationDuration: `${animationSpeed}s`,
  };

  return (
    <div className={`animated-gradient-text ${className}`}>
      {showBorder && (
        <div className="gradient-overlay" style={gradientStyle}></div>
      )}
      <div
        className={`text-content text-[16px] sm:text-[20px] md:text-[28px] lg:text-[36px] xl:text-[48px] font-bold`}
        style={gradientStyle}
      >
        {children}
      </div>
    </div>
  );
}
