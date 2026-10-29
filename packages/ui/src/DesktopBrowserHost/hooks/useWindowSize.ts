import { useEffect, useState } from 'react';

export const useWindowSize = () => {
  const [size, setSize] = useState(readSize);
  useEffect(() => {
    const measure = () =>
      setSize((previous) => {
        const next = readSize();
        return previous.width === next.width && previous.height === next.height ? previous : next;
      });
    window.addEventListener('resize', measure);
    measure();
    return () => window.removeEventListener('resize', measure);
  }, []);
  return size;
};

const readSize = () => ({ width: window.innerWidth, height: window.innerHeight });
