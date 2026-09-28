import { useEffect, useState } from 'react';
import Icon from '@/components/app/Icon';
import usePreview from '@/hooks/usePreview';

export default function PreviewPanel({ source, settings, progress, error, onPalette }) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const count = source ? source.count : 0;
  const idx = Math.min(frame, Math.max(0, count - 1));
  const canvasRef = usePreview(source, settings, idx, onPalette);

  useEffect(() => {
    if (!playing || !count) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % count), 1000 / settings.fps);
    return () => clearInterval(t);
  }, [playing, count, settings.fps]);

  return (
    <div className="preview">
      <div className="viewport">
        {source ? (
          <canvas ref={canvasRef} className="canvas" style={{ width: zoom * 100 + '%' }} />
        ) : (
          <div className="viewport-status">
            {error ? <span className="err">{error}</span> :
              <span className="muted">extracting...{progress && progress.total ? ` (${progress.done}/${progress.total})` : ''}</span>}
          </div>
        )}
      </div>
      <div className="controls">
        <button className="btn icon-btn" disabled={!count} onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <div className="chips">
          {[1, 2, 4].map((z) => (
            <button key={z} className={'chip' + (z === zoom ? ' active' : '')} onClick={() => setZoom(z)}>{z}x</button>
          ))}
        </div>
        <input type="range" className="range grow" min={0} max={Math.max(0, count - 1)} value={idx}
          disabled={!count} onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)); }} />
        <span className="label mono">Frame {count ? idx + 1 : 0}/{count}</span>
      </div>
    </div>
  );
}