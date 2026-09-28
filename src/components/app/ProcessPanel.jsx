import { CopyButton } from '@/components/app/Controls';

export default function ProcessPanel({ proc, disabled, onProcess, onSaveName }) {
  const { busy, status, result, error } = proc;
  const pct = status ? ((status.step - 1 + (status.total ? status.done / status.total : status.label === 'done' ? 1 : 0)) / status.steps) * 100 : 0;
  return (
    <div className="stack">
      <button className="btn primary full" disabled={busy || disabled} onClick={onProcess}>Process</button>
      {status && (
        <div className="status">
          <div className="status-row">
            <span className={status.label === 'done' ? 'ok' : ''}>
              {status.label === 'done' ? 'done' : status.label + '...'}
              {status.total ? ` (${status.done}/${status.total})` : ''}
            </span>
            <span className="muted mono">{status.step}/{status.steps}</span>
          </div>
          <div className="bar"><div className="bar-fill" style={{ width: pct + '%' }} /></div>
        </div>
      )}
      {error && <p className="err small">{error}</p>}
      {result && (
        <div className="card stack">
          <div className="url-row">
            <input className="input mono" readOnly value={result.url} onFocus={(e) => e.target.select()} />
            <CopyButton text={result.url} />
          </div>
          {result.local && <p className="warn small">Upload failed. This link only works in this browser.</p>}
          <button className="btn secondary" onClick={onSaveName}>Save with name</button>
        </div>
      )}
    </div>
  );
}