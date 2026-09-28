import { Slider, Section } from '@/components/app/Controls';
import { DEFAULTS } from '@/lib/defaults';

const signed = (v) => (v > 0 ? '+' + v : String(v));

export default function AdjustSection({ settings, update }) {
  const reset = (k) => () => update({ [k]: DEFAULTS[k] });
  return (
    <Section title="Image adjustments">
      <Slider label="Brightness" value={settings.brightness} min={-100} max={100} display={signed(settings.brightness)}
        onChange={(v) => update({ brightness: v })} onReset={reset('brightness')} />
      <Slider label="Contrast" value={settings.contrast} min={-100} max={100} display={signed(settings.contrast)}
        onChange={(v) => update({ contrast: v })} onReset={reset('contrast')} />
      <Slider label="Saturation" value={settings.saturation} min={0} max={200} display={settings.saturation + '%'}
        onChange={(v) => update({ saturation: v })} onReset={reset('saturation')} />
      <Slider label="Gamma" value={settings.gamma} min={0.5} max={3} step={0.05} display={settings.gamma.toFixed(2)}
        onChange={(v) => update({ gamma: v })} onReset={reset('gamma')} />
    </Section>
  );
}