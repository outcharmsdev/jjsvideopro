import * as Comlink from 'comlink';
import { SRC_SIZE } from '@/lib/pixel';
import { getFFmpegPool } from '@/lib/ffmpegPool';

const FS = SRC_SIZE * SRC_SIZE * 4;
let lock = Promise.resolve();

export function isGif(file) {
  return file.type === 'image/gif' || /\.gif$/i.test(file.name);
}

function probeDuration(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    v.preload = 'metadata';
    v.onloadedmetadata = () => { resolve(v.duration); URL.revokeObjectURL(url); };
    v.onerror = () => { resolve(0); URL.revokeObjectURL(url); };
    v.src = url;
  });
}

async function extractFFmpeg(file, fps, onProgress) {
  const pool = await getFFmpegPool();
  const dur = await probeDuration(file);
  const known = isFinite(dur) && dur > 0;
  const total = known ? Math.max(1, Math.round(dur * fps)) : 0;
  const k = known ? Math.max(1, Math.min(pool.length, Math.ceil(dur / 1.5))) : 1;
  const seg = known ? dur / k : 0;
  const key = file.name + ':' + file.size + ':' + file.lastModified;
  let done = 0;
  const cb = Comlink.proxy((n) => { done += n; onProgress(Math.min(done, total || done), total); });
  const outs = await Promise.all(Array.from({ length: k }, (_, i) =>
    pool[i].extract(file, key, i * seg, i === k - 1 ? 0 : seg, fps, SRC_SIZE, cb)));
  const bytes = outs.reduce((a, o) => a + o.length, 0);
  const count = Math.floor(bytes / FS);
  if (!count) throw new Error('Could not decode this file');
  const data = new Uint8Array(count * FS);
  let off = 0;
  for (const o of outs) {
    const usable = Math.floor(o.length / FS) * FS;
    data.set(o.subarray(0, usable), off);
    off += usable;
  }
  onProgress(count, count);
  return { data, count };
}

async function decodeGif(file) {
  const decoder = new ImageDecoder({ data: await file.arrayBuffer(), type: 'image/gif' });
  await decoder.completed;
  const n = decoder.tracks.selectedTrack.frameCount;
  const data = new Uint8Array(n * FS);
  const durs = new Float64Array(n);
  let buf = null;
  for (let i = 0; i < n; i++) {
    const { image } = await decoder.decode({ frameIndex: i });
    let fmt = image.format;
    let opts;
    if (!['RGBA', 'RGBX', 'BGRA', 'BGRX'].includes(fmt)) { opts = { format: 'RGBA' }; fmt = 'RGBA'; }
    const need = image.allocationSize(opts);
    if (!buf || buf.length < need) buf = new Uint8Array(need);
    const layout = await image.copyTo(buf, opts);
    const { offset, stride } = layout[0];
    const w = image.visibleRect.width, h = image.visibleRect.height;
    const bgr = fmt[0] === 'B';
    const base = i * FS;
    for (let y = 0; y < SRC_SIZE; y++) {
      const row = offset + ((y * h / SRC_SIZE) | 0) * stride;
      for (let x = 0; x < SRC_SIZE; x++) {
        const si = row + ((x * w / SRC_SIZE) | 0) * 4;
        const di = base + (y * SRC_SIZE + x) * 4;
        data[di] = buf[bgr ? si + 2 : si];
        data[di + 1] = buf[si + 1];
        data[di + 2] = buf[bgr ? si : si + 2];
        data[di + 3] = 255;
      }
    }
    const d = (image.duration || 0) / 1000;
    durs[i] = d < 20 ? 100 : d;
    image.close();
  }
  decoder.close();
  return { data, durs, count: n };
}

function resampleGif(gif, fps) {
  const totalMs = gif.durs.reduce((a, d) => a + d, 0);
  const count = Math.max(1, Math.round((totalMs / 1000) * fps));
  const data = new Uint8Array(count * FS);
  let src = 0, acc = gif.durs[0];
  for (let k = 0; k < count; k++) {
    const t = (k * 1000) / fps;
    while (t >= acc && src < gif.count - 1) { src++; acc += gif.durs[src]; }
    data.set(gif.data.subarray(src * FS, (src + 1) * FS), k * FS);
  }
  return { data, count };
}

// One extractor per file. Caches the latest fps result and shares progress listeners.
export function createExtractor(file) {
  const gif = isGif(file) && 'ImageDecoder' in window;
  let gifPromise = null;
  let entry = null;
  return {
    get(fps, onProgress) {
      if (entry && entry.fps === fps) {
        if (onProgress) entry.listeners.add(onProgress);
        return entry.promise;
      }
      const listeners = new Set(onProgress ? [onProgress] : []);
      const emit = (d, t) => listeners.forEach((l) => l(d, t));
      const promise = (async () => {
        const t0 = performance.now();
        let out;
        if (gif) {
          gifPromise = gifPromise || decodeGif(file);
          out = resampleGif(await gifPromise, fps);
          emit(out.count, out.count);
        } else {
          const run = lock.then(() => extractFFmpeg(file, fps, emit));
          lock = run.catch(() => {});
          out = await run;
        }
        const ms = performance.now() - t0;
        return { ...out, w: SRC_SIZE, h: SRC_SIZE, fps, extractMs: ms };
      })();
      entry = { fps, promise, listeners };
      return promise;
    },
  };
}