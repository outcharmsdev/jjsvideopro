// Core pixel algorithms. Pure functions on typed arrays, shared by workers.
export const SRC_SIZE = 160;
export const LUT_SIZE = 32768;

export function buildToneLut({ brightness, contrast, gamma }) {
  const lut = new Uint8Array(256);
  const b = brightness * 2.55;
  const c = contrast * 2.55;
  const f = (259 * (c + 255)) / (255 * (259 - c));
  const ig = 1 / gamma;
  for (let i = 0; i < 256; i++) {
    let v = f * (i + b - 128) + 128;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    lut[i] = 255 * Math.pow(v / 255, ig) + 0.5;
  }
  return lut;
}

// Nearest-neighbor resize RGBA -> RGB with tone + saturation applied in the same pass.
export function createResizer(srcW, srcH, size, tone, sat) {
  const xs = new Int32Array(size);
  const ys = new Int32Array(size);
  for (let i = 0; i < size; i++) {
    xs[i] = ((i * srcW / size) | 0) * 4;
    ys[i] = ((i * srcH / size) | 0) * srcW * 4;
  }
  const doSat = sat !== 1;
  return function (src, srcOff, dst, dstOff) {
    let di = dstOff;
    for (let y = 0; y < size; y++) {
      const row = srcOff + ys[y];
      for (let x = 0; x < size; x++) {
        const si = row + xs[x];
        let r = tone[src[si]], g = tone[src[si + 1]], b = tone[src[si + 2]];
        if (doSat) {
          const l = 0.299 * r + 0.587 * g + 0.114 * b;
          r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
        }
        dst[di] = r; dst[di + 1] = g; dst[di + 2] = b;
        di += 3;
      }
    }
  };
}

export function accumulate(rgb, counts, sums) {
  for (let i = 0; i < rgb.length; i += 3) {
    const r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    counts[k]++;
    const s = k * 3;
    sums[s] += r; sums[s + 1] += g; sums[s + 2] += b;
  }
}

function makeBox(keys, counts, start, end) {
  let r0 = 31, r1 = 0, g0 = 31, g1 = 0, b0 = 31, b1 = 0, count = 0;
  for (let i = start; i < end; i++) {
    const k = keys[i];
    const r = k >> 10, g = (k >> 5) & 31, b = k & 31;
    if (r < r0) r0 = r; if (r > r1) r1 = r;
    if (g < g0) g0 = g; if (g > g1) g1 = g;
    if (b < b0) b0 = b; if (b > b1) b1 = b;
    count += counts[k];
  }
  const rr = r1 - r0, gr = g1 - g0, br = b1 - b0;
  const range = Math.max(rr, gr, br);
  const ch = range === rr ? 0 : range === gr ? 1 : 2;
  return { start, end, count, range, ch };
}

// Median cut over the global 5-bit histogram of every pixel in every frame.
export function medianCut(counts, sums, n) {
  let m = 0;
  for (let k = 0; k < LUT_SIZE; k++) if (counts[k]) m++;
  const keys = new Uint32Array(m);
  for (let k = 0, j = 0; k < LUT_SIZE; k++) if (counts[k]) keys[j++] = k;
  if (m === 0) return new Uint8Array([0, 0, 0]);
  const boxes = [makeBox(keys, counts, 0, m)];
  while (boxes.length < n) {
    let best = -1, bestRange = -1, bestCount = -1;
    for (let i = 0; i < boxes.length; i++) {
      const bx = boxes[i];
      if (bx.end - bx.start < 2) continue;
      if (bx.range > bestRange || (bx.range === bestRange && bx.count > bestCount)) {
        best = i; bestRange = bx.range; bestCount = bx.count;
      }
    }
    if (best < 0) break;
    const bx = boxes[best];
    const shift = bx.ch === 0 ? 10 : bx.ch === 1 ? 5 : 0;
    const seg = keys.subarray(bx.start, bx.end);
    for (let i = 0; i < seg.length; i++) seg[i] = (((seg[i] >> shift) & 31) << 15) | seg[i];
    seg.sort();
    for (let i = 0; i < seg.length; i++) seg[i] &= 0x7fff;
    const half = bx.count / 2;
    let acc = 0, cut = bx.end - 1;
    for (let i = bx.start; i < bx.end; i++) {
      acc += counts[keys[i]];
      if (acc >= half) { cut = i + 1; break; }
    }
    if (cut >= bx.end) cut = bx.end - 1;
    if (cut <= bx.start) cut = bx.start + 1;
    boxes[best] = makeBox(keys, counts, bx.start, cut);
    boxes.push(makeBox(keys, counts, cut, bx.end));
  }
  const palette = new Uint8Array(boxes.length * 3);
  boxes.forEach((bx, j) => {
    let r = 0, g = 0, b = 0, c = 0;
    for (let i = bx.start; i < bx.end; i++) {
      const k = keys[i], s = k * 3;
      r += sums[s]; g += sums[s + 1]; b += sums[s + 2]; c += counts[k];
    }
    palette[j * 3] = Math.round(r / c);
    palette[j * 3 + 1] = Math.round(g / c);
    palette[j * 3 + 2] = Math.round(b / c);
  });
  return palette;
}

// 32x32x32 LUT: 5-bit RGB -> nearest palette index, O(1) lookup afterwards.
export function buildLut(palette) {
  const n = palette.length / 3;
  const lut = new Uint8Array(LUT_SIZE);
  for (let k = 0; k < LUT_SIZE; k++) {
    const r = ((k >> 10) << 3) | 4, g = (((k >> 5) & 31) << 3) | 4, b = ((k & 31) << 3) | 4;
    let best = 0, bd = 1e9;
    for (let j = 0, p = 0; j < n; j++, p += 3) {
      const dr = r - palette[p], dg = g - palette[p + 1], db = b - palette[p + 2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bd) { bd = d; best = j; }
    }
    lut[k] = best;
  }
  return lut;
}

const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const B8 = (() => {
  const q = [0, 2, 3, 1];
  const m = new Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    m[y * 8 + x] = 4 * B4[(y & 3) * 4 + (x & 3)] + q[(y >> 2) * 2 + (x >> 2)];
  }
  return m;
})();

export function createMapper(palette, lut, mode, size) {
  const n = palette.length / 3;
  if (mode === 'fs') {
    const rowLen = (size + 2) * 3;
    const a = new Float32Array(rowLen), b = new Float32Array(rowLen);
    return (rgb, off, out, outOff) => {
      let cur = a, nxt = b;
      cur.fill(0); nxt.fill(0);
      let i = off, o = outOff;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const e = (x + 1) * 3;
          let r = rgb[i] + cur[e], g = rgb[i + 1] + cur[e + 1], bl = rgb[i + 2] + cur[e + 2];
          r = r < 0 ? 0 : r > 255 ? 255 : r | 0;
          g = g < 0 ? 0 : g > 255 ? 255 : g | 0;
          bl = bl < 0 ? 0 : bl > 255 ? 255 : bl | 0;
          const k = lut[((r >> 3) << 10) | ((g >> 3) << 5) | (bl >> 3)];
          out[o++] = k;
          const p = k * 3;
          const er = r - palette[p], eg = g - palette[p + 1], eb = bl - palette[p + 2];
          cur[e + 3] += er * 0.4375; cur[e + 4] += eg * 0.4375; cur[e + 5] += eb * 0.4375;
          nxt[e - 3] += er * 0.1875; nxt[e - 2] += eg * 0.1875; nxt[e - 1] += eb * 0.1875;
          nxt[e] += er * 0.3125; nxt[e + 1] += eg * 0.3125; nxt[e + 2] += eb * 0.3125;
          nxt[e + 3] += er * 0.0625; nxt[e + 4] += eg * 0.0625; nxt[e + 5] += eb * 0.0625;
          i += 3;
        }
        const t = cur; cur = nxt; nxt = t; nxt.fill(0);
      }
    };
  }
  if (mode === 'bayer4' || mode === 'bayer8') {
    const dim = mode === 'bayer4' ? 4 : 8;
    const mat = dim === 4 ? B4 : B8;
    const spread = 255 / Math.cbrt(n);
    const offs = new Float32Array(dim * dim);
    for (let j = 0; j < offs.length; j++) offs[j] = ((mat[j] + 0.5) / offs.length - 0.5) * spread;
    const mask = dim - 1;
    return (rgb, off, out, outOff) => {
      let i = off, o = outOff;
      for (let y = 0; y < size; y++) {
        const rowOff = (y & mask) * dim;
        for (let x = 0; x < size; x++) {
          const t = offs[rowOff + (x & mask)];
          let r = rgb[i] + t, g = rgb[i + 1] + t, bl = rgb[i + 2] + t;
          r = r < 0 ? 0 : r > 255 ? 255 : r | 0;
          g = g < 0 ? 0 : g > 255 ? 255 : g | 0;
          bl = bl < 0 ? 0 : bl > 255 ? 255 : bl | 0;
          out[o++] = lut[((r >> 3) << 10) | ((g >> 3) << 5) | (bl >> 3)];
          i += 3;
        }
      }
    };
  }
  const len = size * size;
  return (rgb, off, out, outOff) => {
    for (let j = 0, i = off; j < len; j++, i += 3) {
      out[outOff + j] = lut[((rgb[i] >> 3) << 10) | ((rgb[i + 1] >> 3) << 5) | (rgb[i + 2] >> 3)];
    }
  };
}

export function fnv1a(arr, start, end) {
  let h = 2166136261;
  for (let i = start; i < end; i++) {
    h ^= arr[i];
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}