import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/app/Icon';
import SavedItem from '@/components/app/SavedItem';

export default function SavedUrls({ saved, prefill }) {
  const [open, setOpen] = useState(true);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const nameRef = useRef(null);

  useEffect(() => {
    if (!prefill) return;
    setOpen(true);
    setUrl(prefill.url);
    setTimeout(() => nameRef.current && nameRef.current.focus(), 0);
  }, [prefill]);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    saved.add({ id: crypto.randomUUID(), name: name.trim(), url: url.trim(), date: Date.now() });
    setName(''); setUrl('');
  };

  return (
    <div className="card">
      <button className="collapse-head" onClick={() => setOpen((o) => !o)}>
        <span className="card-title">Saved URLs</span>
        <span className="muted small">{saved.list.length}</span>
        <span className={'chev' + (open ? ' open' : '')}><Icon name="chevron" /></span>
      </button>
      {open && (
        <div className="stack top-gap">
          <form className="save-form" onSubmit={submit}>
            <input ref={nameRef} className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input mono grow" placeholder="URL" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn primary" type="submit">Save</button>
          </form>
          {saved.list.map((s) => (
            <SavedItem key={s.id} item={s} onRename={(n) => saved.update(s.id, { name: n })} onDelete={() => saved.remove(s.id)} />
          ))}
        </div>
      )}
    </div>
  );
}