import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  strong?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function GlassCard({
  children,
  className = '',
  hover = false,
  strong = false,
  onClick,
  style
}: GlassCardProps) {
  const baseClass = strong ? 'glass-card-strong' : 'glass-card';
  const hoverClass = hover ? 'hover:scale-[1.02] cursor-pointer' : '';
  const transitionClass = 'transition-all duration-300';

  return (
    <div
      className={`${baseClass} ${hoverClass} ${transitionClass} rounded-2xl ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}
