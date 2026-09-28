export const DEFAULTS = {
  res: 64,
  palette: 32,
  fps: 15,
  dither: 'fs',
  brightness: 0,
  contrast: 0,
  saturation: 100,
  gamma: 1,
};

export const DITHER_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'fs', label: 'Floyd-Steinberg' },
  { value: 'bayer4', label: 'Bayer 4x4' },
  { value: 'bayer8', label: 'Bayer 8x8' },
];