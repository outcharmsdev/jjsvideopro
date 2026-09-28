import { useCallback, useEffect, useRef, useState } from 'react';
import '@/styles/app.css';
import Header from '@/components/app/Header';
import DropZone from '@/components/app/DropZone';
import Workspace from '@/components/app/Workspace';
import HistoryList from '@/components/app/HistoryList';
import SavedUrls from '@/components/app/SavedUrls';
import SettingsDrawer from '@/components/app/SettingsDrawer';
import useSource from '@/hooks/useSource';
import useProcessor from '@/hooks/useProcessor';
import useStoredList from '@/hooks/useStoredList';
import { DEFAULTS } from '@/lib/defaults';
import { getFFmpegPool } from '@/lib/ffmpegPool';
import { warmWorkers } from '@/lib/pipeline';

export default function Home() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [file, setFile] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(() => window.innerWidth >= 900);
  const [palette, setPalette] = useState([]);
  const [prefill, setPrefill] = useState(null);
  const [pendingRun, setPendingRun] = useState(false);
  const inputRef = useRef(null);
  const src = useSource(file, settings.fps);
  const proc = useProcessor();
  const history = useStoredList('jj_history', 20);
  const saved = useStoredList('jj_saved', 500);

  useEffect(() => { warmWorkers(); getFFmpegPool().catch(() => {}); }, []);

  const update = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), []);
  const pick = () => inputRef.current.click();
  const onFile = (f) => { setFile(f); setPalette([]); proc.reset(); };

  const process = async () => {
    const s = settings;
    const r = await proc.run({ getSource: src.getSource, settings: s, fileName: file.name });
    if (r && !r.local) {
      history.add({ id: crypto.randomUUID(), fileName: file.name, width: s.res, height: s.res, fps: s.fps,
        paletteSize: s.palette, dithering: s.dither, url: r.url, date: Date.now() });
    }
  };

  const reprocess = (h) => {
    update({ res: h.width, fps: h.fps, palette: h.paletteSize, dither: h.dithering });
    if (file) setPendingRun(true); else pick();
  };

  useEffect(() => {
    if (pendingRun && file && !proc.busy) { setPendingRun(false); process(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRun, settings]);

  return (
    <div className="app">
      <Header drawerOpen={drawerOpen} onToggle={() => setDrawerOpen((o) => !o)} />
      <input ref={inputRef} type="file" accept="video/*,image/gif" hidden
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ''; }} />
      <div className={'layout' + (drawerOpen ? ' with-drawer' : '')}>
        <main className="main">
          {file ? (
            <Workspace file={file} src={src} settings={settings} proc={proc} onPalette={setPalette}
              onProcess={process} onChangeFile={pick}
              onSaveName={() => setPrefill({ url: proc.result.url, n: Date.now() })} />
          ) : (
            <DropZone onFile={onFile} onPick={pick} />
          )}
          <HistoryList history={history} onReprocess={reprocess} />
          <SavedUrls saved={saved} prefill={prefill} />
        </main>
        <SettingsDrawer open={drawerOpen} settings={settings} update={update} palette={palette}
          onClose={() => setDrawerOpen(false)} />
      </div>
    </div>
  );
}