import { useReadingProgress } from '@/hooks/useReadingProgress';

/**
 * Reading progress bar component
 * Shows a fixed progress bar at the top of the page indicating scroll position
 */
export const ReadingProgress = () => {
  const progress = useReadingProgress();

  return (
    <div
      className="fixed top-0 left-0 right-0 h-1 bg-gray-800/50 z-50"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
    >
      <div
        className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};
