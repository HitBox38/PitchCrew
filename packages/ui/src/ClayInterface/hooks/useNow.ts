import { useEffect, useState } from 'react';

/** Current time, refreshed each minute so timelines advance without re-render churn. */
export const useNow = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
};
