
import React from 'react';
import { RANKS } from '../constants';
import { Shield } from 'lucide-react';

interface RankBadgeProps {
  level: number;
  showTitle?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const RankBadge: React.FC<RankBadgeProps> = ({ level, showTitle = true, size = 'sm' }) => {
  // Find highest rank achieved
  const rank = [...RANKS].reverse().find(r => level >= r.minLevel) || RANKS[0];

  const sizeClasses = {
      sm: { icon: 14, text: 'text-[10px]' },
      md: { icon: 18, text: 'text-xs' },
      lg: { icon: 24, text: 'text-sm' }
  };

  return (
    <div className={`inline-flex items-center gap-1 bg-black/40 border border-gray-800 rounded-full px-2 py-0.5 ${rank.color} shadow-sm`}>
      <Shield size={sizeClasses[size].icon} fill="currentColor" className="opacity-20" />
      <span className={`font-black ${sizeClasses[size].text}`}>LVL {level}</span>
      {showTitle && <span className={`font-bold uppercase tracking-wider ${sizeClasses[size].text} opacity-80 border-l border-gray-700 pl-1 ml-1`}>{rank.title}</span>}
    </div>
  );
};

export default RankBadge;
