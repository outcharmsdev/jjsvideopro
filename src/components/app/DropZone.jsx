import { useState } from 'react';
import Icon from '@/components/app/Icon';

export default function DropZone({ onFile, onPick }) {
  const [over, setOver] = useState(false);
  const drop = (e) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };
  return (
    <div className={'dropzone' + (over ? ' over' : '')} onClick={onPick}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)} onDrop={drop}>
      <p className="drop-title">Drag a video or GIF here</p>
      <p className="muted">or click to choose</p>
      <button className="btn" onClick={(e) => { e.stopPropagation(); onPick(); }}>
        <Icon name="upload" />Choose file
      </button>
    </div>
  );
}