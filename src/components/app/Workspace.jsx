import PreviewPanel from '@/components/app/PreviewPanel';
import ProcessPanel from '@/components/app/ProcessPanel';

export default function Workspace({ file, src, settings, proc, onPalette, onProcess, onSaveName, onChangeFile }) {
  const { source, progress, error } = src;
  const count = source ? source.count : 0;
  return (
    <div className="card stack">
      <div className="file-row">
        <span className="small strong ellipsis">{file.name}</span>
        <button className="btn-text" onClick={onChangeFile}>Change file</button>
      </div>
      <PreviewPanel key={file.name + file.size} source={source} settings={settings} progress={progress} error={error} onPalette={onPalette} />
      <p className="info mono">
        Blocks: {settings.res * settings.res} | Frames: {count} | Duration: {(count / settings.fps).toFixed(1)}s | Palette: {settings.palette}
      </p>
      <ProcessPanel proc={proc} disabled={!!error} onProcess={onProcess} onSaveName={onSaveName} />
    </div>
  );
}