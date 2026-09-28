import { useCallback, useEffect, useRef } from 'react';
import * as Comlink from 'comlink';
import { getPreviewWorker } from '@/lib/pipeline';

const SAMPLE = 24;

// Renders only the current frame in a worker. Latest request wins, older ones are dropped.
export default function usePreview(source, settings, frameIdx, onPalette) {
  const canvasRef = useRef(null);
  const busy = useRef(false);
  const pending = useRef(null);
  const settingsRef = useRef(settings);
  const lastPal = useRef('');
  settingsRef.current = settings;

  useEffect(() => {
    if (!source) return;
    const fs = source.w * source.h * 4;
    const n = Math.min(SAMPLE, source.count);
    const data = new Uint8Array(n * fs);
    for (let i = 0; i < n; i++) {
      const f = Math.floor((i * source.count) / n);
      data.set(source.data.subarray(f * fs, (f + 1) * fs), i * fs);
    }
    getPreviewWorker().setSample(Comlink.transfer(data, [data.buffer]), source.w, source.h, n);
  }, [source]);

  const pump = useCallback(async () => {
    if (busy.current || pending.current == null || !source) return;
    busy.current = true;
    const idx = Math.min(pending.current, source.count - 1);
    pending.current = null;
    const fs = source.w * source.h * 4;
    const frame = source.data.slice(idx * fs, (idx + 1) * fs);
    const r = await getPreviewWorker().render(Comlink.transfer(frame, [frame.buffer]), source.w, source.h, settingsRef.current);
    const c = canvasRef.current;
    if (c) {
      if (c.width !== r.size) { c.width = r.size; c.height = r.size; }
      c.getContext('2d').putImageData(new ImageData(r.rgba, r.size, r.size), 0, 0);
    }
    const key = r.palette.join(',');
    if (key !== lastPal.current) { lastPal.current = key; onPalette(Array.from(r.palette)); }
    busy.current = false;
    pump();
  }, [source, onPalette]);

  const request = useCallback((i) => { pending.current = i; pump(); }, [pump]);

  useEffect(() => { request(frameIdx); }, [frameIdx, request]);

  useEffect(() => {
    const t = setTimeout(() => request(frameIdx), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  return canvasRef;
}