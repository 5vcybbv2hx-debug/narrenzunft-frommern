import { RefreshCw } from 'lucide-react';

const THRESHOLD = 70;

export default function PullToRefreshIndicator({ pullDistance, refreshing }) {
  if (pullDistance === 0 && !refreshing) return null;

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const ready = progress >= 1 || refreshing;

  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-all duration-150"
      style={{ height: refreshing ? 48 : pullDistance, opacity: progress }}
    >
      <div className={`w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
        <RefreshCw
          size={16}
          className="text-primary transition-transform"
          style={{ transform: `rotate(${progress * 180}deg)` }}
        />
      </div>
    </div>
  );
}