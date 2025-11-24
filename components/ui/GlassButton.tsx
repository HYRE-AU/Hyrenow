import React from 'react';
import { Loader2 } from 'lucide-react';

interface GlassButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export function GlassButton({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  onClick,
  type = 'button',
  className = ''
}: GlassButtonProps) {
  const baseClasses = 'font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2';

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-[#5B8DEF] to-[#9D6DD9] text-white hover:shadow-glow-purple hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
    secondary:
      'glass-card text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed',
    ghost:
      'text-[#9D6DD9] hover:bg-[#B88EE8]/20 disabled:opacity-50 disabled:cursor-not-allowed',
    destructive:
      'bg-[#F07B7B] text-white hover:bg-[#ED6868] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed'
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3',
    lg: 'px-8 py-4 text-lg'
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {!loading && icon && icon}
      {children}
    </button>
  );
}
