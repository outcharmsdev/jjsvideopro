import { useState } from 'react';
import Icon from '@/components/app/Icon';

export function Slider({ label, value, min, max, step = 1, onChange, display, onReset }) {
  return (
    <div className="field">
      <div className="field-head">
        <span className="label">{label}</span>
        <span className="value">{display ?? value}</span>
        {onReset && <button className="btn-text" onClick={onReset}>Reset</button>}
      </div>
      <input type="range" className="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function Presets({ values, value, onChange, format = (v) => v }) {
  return (
    <div className="chips">
      {values.map((v) => (
        <button key={v} className={'chip' + (v === value ? ' active' : '')} onClick={() => onChange(v)}>{format(v)}</button>
      ))}
    </div>
  );
}

export function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setDone(true);
    setTimeout(() => setDone(false), 1200);
  };
  return (
    <button className="btn" onClick={copy}>
      <Icon name={done ? 'check' : 'copy'} />{done ? 'Copied' : label}
    </button>
  );
}

export function Section({ title, children }) {
  return (
    <section className="section">
      <h3 className="section-title">{title}</h3>
      {children}
    </section>
  );
}