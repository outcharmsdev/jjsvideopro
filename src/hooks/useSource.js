import { useCallback, useEffect, useRef, useState } from 'react';
import { createExtractor } from '@/lib/extract';

export default function useSource(file, fps) {
  const exRef = useRef(null);
  const [source, setSource] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    exRef.current = file ? createExtractor(file) : null;
    setSource(null);
    setError('');
  }, [file]);

  useEffect(() => {
    if (!file) return;
    let alive = true;
    const timer = setTimeout(() => {
      let last = 0;
      setProgress({ done: 0, total: 0 });
      exRef.current.get(fps, (done, total) => {
        const now = performance.now();
        if (alive && now - last >= 200) { last = now; setProgress({ done, total }); }
      }).then((s) => {
        if (alive) { setSource(s); setProgress(null); }
      }).catch((e) => {
        if (alive) { setError(e.message || 'Could not decode this file'); setProgress(null); }
      });
    }, 150);
    return () => { alive = false; clearTimeout(timer); };
  }, [file, fps]);

  const getSource = useCallback((onP) => exRef.current.get(fps, onP), [fps]);

  return { source, progress, error, getSource };
}