import { useCallback, useState } from 'react';
import { runPipeline } from '@/lib/pipeline';

export default function useProcessor() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = useCallback(async (params) => {
    setBusy(true); setError(''); setResult(null);
    let last = 0;
    const report = (s, force) => {
      const now = performance.now();
      if (force || now - last >= 200) { last = now; setStatus(s); }
    };
    try {
      const r = await runPipeline({ ...params, report });
      setStatus({ label: 'done', step: 6, steps: 6, done: 0, total: 0 });
      setResult(r);
      return r;
    } catch (e) {
      setError(e.message || String(e));
      setStatus(null);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = useCallback(() => { setStatus(null); setResult(null); setError(''); }, []);

  return { busy, status, result, error, run, reset };
}