import { Slider, Presets, Section } from '@/components/app/Controls';
import { DEFAULTS, DITHER_OPTIONS } from '@/lib/defaults';
import AdjustSection from '@/components/app/AdjustSection';

export default function SettingsDrawer({ open, settings, update, palette, onClose }) {
  const blocks = settings.res * settings.res;
  const palIdx = Math.log2(settings.palette);
  return (
    <>
      <div className={'scrim' + (open ? ' show' : '')} onClick={onClose} />
      <aside className={'drawer' + (open ? ' open' : '')}>
        <Section title="Resolution">
          <Slider label="Size" value={settings.res} min={8} max={150} step={4} onChange={(v) => update({ res: v })} />
          <Presets values={[32, 48, 64, 96, 128]} value={settings.res} onChange={(v) => update({ res: v })} />
          <p className="small mono">{settings.res}x{settings.res} = {blocks} blocks</p>
          {blocks > 10000 && <p className="err small">Roblox may lag</p>}
        </Section>

        <Section title="Palette">
          <Slider label="Colors" value={palIdx} min={1} max={8} display={settings.palette}
            onChange={(v) => update({ palette: 2 ** v })} />
          <div className="swatches">
            {palette.length === 0 && <span className="muted small">Load a file to see colors</span>}
            {Array.from({ length: palette.length / 3 }, (_, i) => (
              <span key={i} className="swatch"
                style={{ background: `rgb(${palette[i * 3]},${palette[i * 3 + 1]},${palette[i * 3 + 2]})` }} />
            ))}
          </div>
        </Section>

        <Section title="FPS">
          <Slider label="Frames per second" value={settings.fps} min={1} max={60} onChange={(v) => update({ fps: v })} />
          <Presets values={[10, 15, 24, 30, 60]} value={settings.fps} onChange={(v) => update({ fps: v })} />
        </Section>

        <Section title="Dithering">
          <div className="radios">
            {DITHER_OPTIONS.map((o) => (
              <label key={o.value} className={'radio' + (settings.dither === o.value ? ' checked' : '')}>
                <input type="radio" name="dither" checked={settings.dither === o.value} onChange={() => update({ dither: o.value })} />
                <span className="dot" />{o.label}
              </label>
            ))}
          </div>
        </Section>

        <AdjustSection settings={settings} update={update} />

        <button className="btn secondary full" onClick={() => update(DEFAULTS)}>Reset all</button>
      </aside>
    </>
  );
}