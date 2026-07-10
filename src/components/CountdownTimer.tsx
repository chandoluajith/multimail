import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetTime: string; // ISO string
  onComplete?: () => void;
  className?: string;
  showLabels?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  targetTime,
  onComplete,
  className = '',
  showLabels = false,
}) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    const calculateTime = () => {
      const difference = +new Date(targetTime) - +new Date();

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        if (onComplete) onComplete();
        return true;
      }

      const days    = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours   = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / (1000 * 60)) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
      return false;
    };

    const expired = calculateTime();
    if (expired) return;

    const interval = setInterval(() => {
      const done = calculateTime();
      if (done) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime, onComplete]);

  if (timeLeft.isExpired) {
    return <span className={className}>Ready</span>;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const { days, hours, minutes, seconds } = timeLeft;

  // ── Labeled format (used in control panel header) ────────────────────────
  if (showLabels) {
    if (days > 0) {
      return (
        <span className={className}>
          {days}d {hours}h {pad(minutes)}m
        </span>
      );
    }
    return (
      <span className={className}>
        {hours > 0 && `${hours}h `}
        {minutes}m {pad(seconds)}s
      </span>
    );
  }

  // ── Compact format (used in cards / table rows) ───────────────────────────
  if (days > 0) {
    return (
      <span className={className}>
        {days}d {pad(hours)}h {pad(minutes)}m
      </span>
    );
  }

  return (
    <span className={className}>
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
};
