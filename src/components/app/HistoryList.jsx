import { useState } from 'react';
import { format } from 'date-fns';
import Icon from '@/components/app/Icon';
import { CopyButton } from '@/components/app/Controls';

export default function HistoryList({ history, onReprocess }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="card">
      <button className="collapse-head" onClick={() => setOpen((o) => !o)}>
        <span className="card-title">History</span>
        <span className="muted small">{history.list.length}</span>
        <span className={'chev' + (open ? ' open' : '')}><Icon name="chevron" /></span>
      </button>
      {open && (
        <div className="stack top-gap">
          {history.list.length === 0 && <p className="muted small">No processed files yet.</p>}
          {history.list.map((h) => (
            <div key={h.id} className="row-item">
              <span className="row-text mono small">
                {h.fileName} | {h.width}x{h.height} | {format(h.date, 'MM/dd HH:mm')}
              </span>
              <div className="row-actions">
                <CopyButton text={h.url} />
                <button className="btn" onClick={() => onReprocess(h)}><Icon name="refresh" />Reprocess</button>
                <button className="btn" onClick={() => history.remove(h.id)}><Icon name="trash" />Delete</button>
              </div>
            </div>
          ))}
          {history.list.length > 0 && (
            <button className="btn secondary self-start" onClick={history.clear}>Clear all</button>
          )}
        </div>
      )}
    </div>
  );
}