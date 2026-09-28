const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import * as Comlink from 'comlink';

import { LUT_SIZE } from '@/lib/pixel';

const STEPS = 6;
let pool = null;

export function workerCount() {
  return Math.min(8, Math.max(4, navigator.hardwareConcurrency || 4));
}

function spawn() {
  return Comlink.wrap(new Worker(new URL('../workers/process.worker.js', import.meta.url), { type: 'module' }));
}

export function getPool() {
  if (!pool) pool = Array.from({ length: workerCount() }, spawn);
  return pool;
}

let preview = null;
export function getPreviewWorker() {
  if (!preview) preview = spawn();
  return preview;
}

export function warmWorkers() {
  return Promise.all([...getPool(), getPreviewWorker()].map((w) => w.ping()));
}

export async function runPipeline({ getSource, settings, fileName, report }) {
  const T0 = performance.now();
  const perf = [];
  const mark = (name, t) => perf.push([name, performance.now() - t]);
  const st = (label, step, done = 0, total = 0, force = false) =>
    report({ label, step, steps: STEPS, done, total }, force);

  st('extracting', 1, 0, 0, true);
  const src = await getSource((d, t) => st('extracting', 1, d, t));
  perf.push(['Extract', src.extractMs]);

  const size = settings.res;
  const workers = getPool();
  const n = Math.min(workers.length, src.count);
  const per = Math.ceil(src.count / n);
  const chunks = [];
  for (let i = 0; i < n; i++) {
    const start = i * per, end = Math.min(src.count, start + per);
    if (end > start) chunks.push({ start, end, w: workers[i] });
  }
  const adj = { brightness: settings.brightness, contrast: settings.contrast, saturation: settings.saturation, gamma: settings.gamma };

  // Resize + adjust in parallel; each worker returns its histogram
  let t = performance.now();
  let resized = 0;
  st('resizing', 2, 0, src.count, true);
  const onResize = Comlink.proxy((k) => { resized += k; st('resizing', 2, resized, src.count); });
  const sfs = src.w * src.h * 4;
  const hists = await Promise.all(chunks.map((c) => {
    const slice = src.data.slice(c.start * sfs, c.end * sfs);
    return c.w.resize(Comlink.transfer(slice, [slice.buffer]), src.w, src.h, c.end - c.start, size, adj, onResize);
  }));
  mark('Resize', t);

  // Quantize once over the global histogram
  t = performance.now();
  st('quantizing', 3, 0, 0, true);
  const counts = new Uint32Array(LUT_SIZE), sums = new Float64Array(LUT_SIZE * 3);
  for (const h of hists) {
    for (let k = 0; k < LUT_SIZE; k++) counts[k] += h.counts[k];
    for (let k = 0; k < sums.length; k++) sums[k] += h.sums[k];
  }
  const { palette, lut } = await chunks[0].w.quantize(Comlink.transfer(counts, [counts.buffer]), Comlink.transfer(sums, [sums.buffer]), settings.palette);
  mark('Quantize', t);

  // LUT apply (+ dithering) in parallel
  t = performance.now();
  const dithered = settings.dither !== 'none';
  st(dithered ? 'dithering' : 'mapping', 4, 0, 0, true);
  const hashes = await Promise.all(chunks.map((c) => c.w.map(palette, lut, settings.dither)));
  mark(dithered ? 'Dither (LUT fused)' : 'LUT apply', t);

  // Dedup consecutive identical frames
  t = performance.now();
  st('deduplicating', 5, 0, 0, true);
  const durations = [];
  let prev = -1;
  const masks = hashes.map((hs) => {
    const keep = new Uint8Array(hs.length);
    for (let i = 0; i < hs.length; i++) {
      if (hs[i] === prev) durations[durations.length - 1]++;
      else { keep[i] = 1; durations.push(1); prev = hs[i]; }
    }
    return keep;
  });
  mark('Dedup', t);

  t = performance.now();
  const parts = await Promise.all(chunks.map((c, i) => c.w.build(masks[i])));
  const palParts = [];
  for (let i = 0; i < palette.length; i += 3) palParts.push('[' + palette[i] + ',' + palette[i + 1] + ',' + palette[i + 2] + ']');
  const json = '{"width":' + size + ',"height":' + size + ',"fps":' + settings.fps +
    ',"frameCount":' + durations.length + ',"palette":[' + palParts.join(',') +
    '],"durations":[' + durations.join(',') + '],"frames":[' + parts.filter(Boolean).join(',') + ']}';
  mark('JSON', t);

  // Upload
  t = performance.now();
  st('uploading', 6, 0, 0, true);
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'video';
  const file = new File([json], base + '_' + size + '.json', { type: 'application/json' });
  let url, local = false;
  try {
    url = (await db.integrations.Core.UploadPublicFile({ file })).file_url;
  } catch {
    url = URL.createObjectURL(file);
    local = true;
  }
  mark('Upload', t);

  const total = performance.now() - T0;
  perf.forEach(([k, v]) => console.log('[PERF] ' + k + ': ' + Math.round(v) + 'ms'));
  console.log('[PERF] TOTAL: ' + Math.round(total) + 'ms');
  console.log('[PERF] Workers: ' + chunks.length + '/' + workers.length);
  return { url, local, frames: durations.length, paletteSize: palette.length / 3, bytes: file.size };
}