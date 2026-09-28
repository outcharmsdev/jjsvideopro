import * as Comlink from 'comlink';
import { buildToneLut, createResizer, accumulate, medianCut, buildLut, createMapper, fnv1a, LUT_SIZE } from '@/lib/pixel';

let st = null; // chunk state kept in the worker between pipeline stages
let sample = null;
let cachedKey = null;
let cachedPal = null;

function paletteFromSample(size, adj, n) {
  const tone = buildToneLut(adj);
  const resize = createResizer(sample.w, sample.h, size, tone, adj.saturation / 100);
  const fs = sample.w * sample.h * 4;
  const rgb = new Uint8ClampedArray(size * size * 3);
  const counts = new Uint32Array(LUT_SIZE), sums = new Float64Array(LUT_SIZE * 3);
  for (let i = 0; i < sample.count; i++) {
    resize(sample.data, i * fs, rgb, 0);
    accumulate(rgb, counts, sums);
  }
  const palette = medianCut(counts, sums, n);
  return { palette, lut: buildLut(palette) };
}

const api = {
  ping() { return true; },

  resize(src, srcW, srcH, count, size, adj, onProgress) {
    const tone = buildToneLut(adj);
    const resize = createResizer(srcW, srcH, size, tone, adj.saturation / 100);
    const sfs = srcW * srcH * 4, dfs = size * size * 3;
    const rgb = new Uint8ClampedArray(count * dfs);
    let pending = 0;
    for (let i = 0; i < count; i++) {
      resize(src, i * sfs, rgb, i * dfs);
      if (++pending === 16) { onProgress(pending); pending = 0; }
    }
    if (pending) onProgress(pending);
    const counts = new Uint32Array(LUT_SIZE), sums = new Float64Array(LUT_SIZE * 3);
    accumulate(rgb, counts, sums);
    st = { size, count, rgb, idx: null };
    return Comlink.transfer({ counts, sums }, [counts.buffer, sums.buffer]);
  },

  quantize(counts, sums, n) {
    const palette = medianCut(counts, sums, n);
    const lut = buildLut(palette);
    return { palette, lut };
  },

  map(palette, lut, mode) {
    const { size, count, rgb } = st;
    const fl = size * size;
    const idx = new Uint8Array(count * fl);
    const mapper = createMapper(palette, lut, mode, size);
    const hashes = new Uint32Array(count);
    for (let i = 0; i < count; i++) {
      mapper(rgb, i * fl * 3, idx, i * fl);
      hashes[i] = fnv1a(idx, i * fl, (i + 1) * fl);
    }
    st.idx = idx;
    st.rgb = null;
    return Comlink.transfer(hashes, [hashes.buffer]);
  },

  build(keep) {
    const { size, count, idx } = st;
    const fl = size * size;
    const parts = [];
    for (let i = 0; i < count; i++) {
      if (keep[i]) parts.push('[' + idx.subarray(i * fl, (i + 1) * fl).join(',') + ']');
    }
    st = null;
    return parts.join(',');
  },

  setSample(data, w, h, count) {
    sample = { data, w, h, count };
    cachedKey = null;
  },

  render(frame, w, h, s) {
    const size = s.res;
    const adj = { brightness: s.brightness, contrast: s.contrast, gamma: s.gamma, saturation: s.saturation };
    const key = [size, s.palette, s.brightness, s.contrast, s.gamma, s.saturation].join('|');
    if (key !== cachedKey) { cachedPal = paletteFromSample(size, adj, s.palette); cachedKey = key; }
    const { palette, lut } = cachedPal;
    const resize = createResizer(w, h, size, buildToneLut(adj), s.saturation / 100);
    const rgb = new Uint8ClampedArray(size * size * 3);
    resize(frame, 0, rgb, 0);
    const idx = new Uint8Array(size * size);
    createMapper(palette, lut, s.dither, size)(rgb, 0, idx, 0);
    const rgba = new Uint8ClampedArray(size * size * 4);
    for (let i = 0, o = 0; i < idx.length; i++, o += 4) {
      const p = idx[i] * 3;
      rgba[o] = palette[p]; rgba[o + 1] = palette[p + 1]; rgba[o + 2] = palette[p + 2]; rgba[o + 3] = 255;
    }
    return Comlink.transfer({ rgba, size, palette: palette.slice() }, [rgba.buffer]);
  },
};

Comlink.expose(api);