import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  gradient?: 'blue' | 'purple' | 'cyan' | 'emerald';
  className?: string;
}

const gradientClasses = {
  blue: 'from-[#5B8DEF]/20 to-[#7BA5F3]/15 border-[#7BA5F3]/50',
  purple: 'from-[#9D6DD9]/20 to-[#B88EE8]/15 border-[#B88EE8]/50',
  cyan: 'from-[#4DB8D8]/20 to-[#6BC5E0]/15 border-[#6BC5E0]/50',
  emerald: 'from-[#47C68D]/20 to-[#6DD3A5]/15 border-[#6DD3A5]/50'
};

const iconClasses = {
  blue: 'bg-gradient-to-br from-[#5B8DEF] to-[#7BA5F3]',
  purple: 'bg-gradient-to-br from-[#9D6DD9] to-[#B88EE8]',
  cyan: 'bg-gradient-to-br from-[#4DB8D8] to-[#6BC5E0]',
  emerald: 'bg-gradient-to-br from-[#47C68D] to-[#6DD3A5]'
};

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  gradient = 'blue',
  className = ''
}: StatCardProps) {
  return (
    <div
      className={`glass-card p-6 bg-gradient-to-br ${gradientClasses[gradient]} animate-fadeInUp ${className}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`${iconClasses[gradient]} p-3 rounded-xl text-white shadow-soft`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>

      {(description || trend) && (
        <div className="flex items-center justify-between text-sm">
          {description && <span className="text-gray-600">{description}</span>}
          {trend && (
            <span
              className={`font-medium ${
                trend.isPositive ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
