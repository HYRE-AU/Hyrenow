import React from 'react';
import { Clock, CheckCircle, XCircle, Mail, ArrowRight, Briefcase } from 'lucide-react';

type StatusType =
  | 'invited'
  | 'in_progress'
  | 'completed'
  | 'progressed'
  | 'rejected'
  | 'active';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig = {
  invited: {
    label: 'Invited',
    icon: Mail,
    classes: 'bg-[#4DB8D8]/15 text-[#2D8FA8] border-[#4DB8D8]/50'
  },
  in_progress: {
    label: 'In Progress',
    icon: Clock,
    classes: 'bg-[#F5C563]/20 text-[#C89940] border-[#F5C563]/60'
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    classes: 'bg-[#9D6DD9]/15 text-[#7B4FB3] border-[#9D6DD9]/50'
  },
  progressed: {
    label: 'Progressed',
    icon: ArrowRight,
    classes: 'bg-[#9D6DD9]/15 text-[#7B4FB3] border-[#9D6DD9]/50'
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    classes: 'bg-[#F07B7B]/15 text-[#C95656] border-[#F07B7B]/50'
  },
  active: {
    label: 'Active',
    icon: Briefcase,
    classes: 'bg-[#47C68D]/15 text-[#349868] border-[#47C68D]/50'
  }
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${config.classes} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}
