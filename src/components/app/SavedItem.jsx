import { useState } from 'react';
import Icon from '@/components/app/Icon';
import { CopyButton } from '@/components/app/Controls';

export default function SavedItem({ item, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const save = () => { if (name.trim()) onRename(name.trim()); setEditing(false); };
  return (
    <div className="row-item">
      {editing ? (
        <input className="input grow" value={name} autoFocus onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} />
      ) : (
        <div className="row-text">
          <span className="small strong">{item.name}</span>
          <span className="mono small muted ellipsis">{item.url}</span>
        </div>
      )}
      <div className="row-actions">
        {editing ? (
          <button className="btn" onClick={save}><Icon name="check" />Save</button>
        ) : (
          <>
            <CopyButton text={item.url} />
            <button className="btn" onClick={() => { setName(item.name); setEditing(true); }}><Icon name="pencil" />Rename</button>
          </>
        )}
        <button className="btn" onClick={onDelete}><Icon name="trash" />Delete</button>
      </div>
    </div>
  );
}