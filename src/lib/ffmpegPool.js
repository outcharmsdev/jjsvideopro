import * as Comlink from 'comlink';

const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/';

// Classic worker (needs importScripts for the FFmpeg WASM core).
const WORKER_SRC = String.raw`
importScripts('https://cdn.jsdelivr.net/npm/comlink@4.4.2/dist/umd/comlink.min.js');
var core = null, written = null, onLog = null, inName = 'input';
Comlink.expose({
  load: async function (coreURL, wasmURL) {
    importScripts(coreURL);
    core = await self.createFFmpegCore({ mainScriptUrlOrBlob: coreURL + '#' + btoa(JSON.stringify({ wasmURL: wasmURL })) });
    core.setLogger(function (d) { if (onLog) onLog(d.message); });
    return true;
  },
  extract: async function (file, key, start, dur, fps, size, onFrames) {
    if (written !== key) {
      if (written) { try { core.FS.unlink(inName); } catch (e) {} }
      var m = /\.[a-zA-Z0-9]+$/.exec(file.name);
      inName = 'input' + (m ? m[0] : '');
      core.FS.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
      written = key;
    }
    var last = 0;
    onLog = function (msg) {
      var mm = /frame=\s*(\d+)/.exec(msg);
      if (mm) { var f = +mm[1]; if (f > last) { onFrames(f - last); last = f; } }
    };
    var args = [];
    if (start > 0) args.push('-ss', String(start));
    args.push('-i', inName);
    if (dur > 0) args.push('-t', String(dur));
    args.push('-vf', 'fps=' + fps + ',scale=' + size + ':' + size + ':flags=neighbor',
      '-f', 'rawvideo', '-pix_fmt', 'rgba', '-an', '-sn', 'out.raw');
    core.setTimeout(-1);
    core.exec.apply(core, args);
    core.reset();
    onLog = null;
    var out;
    try { out = core.FS.readFile('out.raw'); core.FS.unlink('out.raw'); } catch (e) { out = new Uint8Array(0); }
    return Comlink.transfer(out, [out.buffer]);
  }
});
`;

let poolPromise = null;

async function toBlobURL(url, type) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return URL.createObjectURL(new Blob([buf], { type }));
}

export function getFFmpegPool() {
  if (!poolPromise) {
    poolPromise = (async () => {
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(CORE + 'ffmpeg-core.js', 'text/javascript'),
        toBlobURL(CORE + 'ffmpeg-core.wasm', 'application/wasm'),
      ]);
      const n = Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) >> 1));
      const src = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
      const workers = Array.from({ length: n }, () => Comlink.wrap(new Worker(src)));
      await Promise.all(workers.map((w) => w.load(coreURL, wasmURL)));
      return workers;
    })();
    poolPromise.catch(() => { poolPromise = null; });
  }
  return poolPromise;
}