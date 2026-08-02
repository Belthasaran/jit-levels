/**
 * Inject lmauto_menuread.dll into Lunar Magic and read View checkmarks in-process.
 * Cross-process GetMenu/GetMenuState fail under Wine (HMENU is process-local).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const PROCESS_CREATE_THREAD = 0x0002;
const PROCESS_VM_OPERATION = 0x0008;
const PROCESS_VM_WRITE = 0x0020;
const PROCESS_VM_READ = 0x0010;
const PROCESS_QUERY_INFORMATION = 0x0400;
const PROCESS_ACCESS =
  PROCESS_CREATE_THREAD |
  PROCESS_VM_OPERATION |
  PROCESS_VM_WRITE |
  PROCESS_VM_READ |
  PROCESS_QUERY_INFORMATION;

const MEM_COMMIT = 0x1000;
const MEM_RESERVE = 0x2000;
const MEM_RELEASE = 0x8000;
const PAGE_READWRITE = 0x04;

let koffi;
let kernel32;
let user32;
let ready = false;

/** @type {Map<number, { remoteModule: number, remoteFnU32: number }>} */
const injectCache = new Map();

function ensureLoaded() {
  if (ready) return;
  if (process.platform !== 'win32') {
    throw new Error('menu_inject requires Windows Node (Wine)');
  }
  if (process.arch !== 'ia32') {
    throw new Error(
      `menu_inject requires ia32 Node (got ${process.arch}); use lmauto/node-win-x86`
    );
  }
  koffi = require('koffi');
  kernel32 = koffi.load('kernel32.dll');
  user32 = koffi.load('user32.dll');

  user32.FindWindowW = user32.func('FindWindowW', 'void *', ['str16', 'str16']);
  user32.GetWindowThreadProcessId = user32.func('GetWindowThreadProcessId', 'uint32', [
    'void *',
    'uint32 *',
  ]);

  kernel32.OpenProcess = kernel32.func('OpenProcess', 'void *', ['uint32', 'int', 'uint32']);
  kernel32.CloseHandle = kernel32.func('CloseHandle', 'int', ['void *']);
  kernel32.VirtualAllocEx = kernel32.func('VirtualAllocEx', 'void *', [
    'void *',
    'void *',
    'uintptr',
    'uint32',
    'uint32',
  ]);
  kernel32.VirtualFreeEx = kernel32.func('VirtualFreeEx', 'int', [
    'void *',
    'void *',
    'uintptr',
    'uint32',
  ]);
  kernel32.WriteProcessMemory = kernel32.func('WriteProcessMemory', 'int', [
    'void *',
    'void *',
    'void *',
    'uintptr',
    'uintptr *',
  ]);
  kernel32.CreateRemoteThread = kernel32.func('CreateRemoteThread', 'void *', [
    'void *',
    'void *',
    'uintptr',
    'void *',
    'void *',
    'uint32',
    'uint32 *',
  ]);
  kernel32.WaitForSingleObject = kernel32.func('WaitForSingleObject', 'uint32', [
    'void *',
    'uint32',
  ]);
  kernel32.GetExitCodeThread = kernel32.func('GetExitCodeThread', 'int', ['void *', 'uint32 *']);
  kernel32.GetModuleHandleA = kernel32.func('GetModuleHandleA', 'void *', ['str']);
  kernel32.GetProcAddress = kernel32.func('GetProcAddress', 'void *', ['void *', 'str']);
  kernel32.LoadLibraryA = kernel32.func('LoadLibraryA', 'void *', ['str']);
  kernel32.FreeLibrary = kernel32.func('FreeLibrary', 'int', ['void *']);
  kernel32.GetLastError = kernel32.func('GetLastError', 'uint32', []);

  ready = true;
}

/** Decode a 32-bit address as a koffi void*. */
function ptrFromU32(addr) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(addr >>> 0, 0);
  return koffi.decode(buf, 0, 'void *');
}

function addrU32(ptr) {
  if (!ptr) return 0;
  return Number(koffi.address(ptr)) >>> 0;
}

/**
 * Normalize a path for Wine LoadLibraryA / fopen inside LM.
 * Guest Node already sees Z:\… paths; do not double-prefix.
 */
function toWineZPath(anyPath) {
  let abs = path.resolve(anyPath).replace(/\\/g, '/');
  if (/^[A-Za-z]:/.test(abs)) return abs;
  if (abs.startsWith('/')) return `Z:${abs}`;
  return abs;
}

function dllPath() {
  return path.join(__dirname, '..', 'native', 'lmauto_menuread.dll');
}

function allocWrite(hProcess, buf) {
  const remote = kernel32.VirtualAllocEx(
    hProcess,
    null,
    BigInt(buf.length),
    MEM_COMMIT | MEM_RESERVE,
    PAGE_READWRITE
  );
  if (!remote) {
    throw new Error(`VirtualAllocEx failed (err=${kernel32.GetLastError()})`);
  }
  const ok = kernel32.WriteProcessMemory(
    hProcess,
    remote,
    buf,
    BigInt(buf.length),
    null
  );
  if (!ok) {
    kernel32.VirtualFreeEx(hProcess, remote, 0n, MEM_RELEASE);
    throw new Error(`WriteProcessMemory failed (err=${kernel32.GetLastError()})`);
  }
  return remote;
}

function runRemote(hProcess, startAddr, argAddr, timeoutMs) {
  const tid = Buffer.alloc(4);
  const thr = kernel32.CreateRemoteThread(
    hProcess,
    null,
    0n,
    startAddr,
    argAddr,
    0,
    tid
  );
  if (!thr) {
    throw new Error(`CreateRemoteThread failed (err=${kernel32.GetLastError()})`);
  }
  const wait = kernel32.WaitForSingleObject(thr, timeoutMs >>> 0);
  if (wait !== 0) {
    kernel32.CloseHandle(thr);
    throw new Error(`remote thread wait failed (WaitForSingleObject=${wait})`);
  }
  const codeBuf = Buffer.alloc(4);
  if (!kernel32.GetExitCodeThread(thr, codeBuf)) {
    kernel32.CloseHandle(thr);
    throw new Error(`GetExitCodeThread failed (err=${kernel32.GetLastError()})`);
  }
  kernel32.CloseHandle(thr);
  return codeBuf.readUInt32LE(0);
}

/**
 * @param {any} hwnd LMFrame
 * @param {{ timeoutMs?: number, outPath?: string }} [opts]
 * @returns {Record<string, boolean>}
 */
function readMenuChecksInProcess(hwnd, opts = {}) {
  ensureLoaded();
  const dllLinux = dllPath();
  if (!fs.existsSync(dllLinux)) {
    throw new Error(
      `missing ${dllLinux}; run lmauto/native/build_menuread.sh (needs i686-w64-mingw32-gcc)`
    );
  }

  const pidBuf = Buffer.alloc(4);
  user32.GetWindowThreadProcessId(hwnd, pidBuf);
  const pid = pidBuf.readUInt32LE(0);
  if (!pid) throw new Error('GetWindowThreadProcessId failed');

  const hProcess = kernel32.OpenProcess(PROCESS_ACCESS, 0, pid);
  if (!hProcess) {
    throw new Error(`OpenProcess(${pid}) failed (err=${kernel32.GetLastError()})`);
  }

  const outLinux =
    opts.outPath ||
    path.join(os.tmpdir(), `lmauto_menu_${pid}_${Date.now()}.json`);
  const dllWin = toWineZPath(dllLinux);
  const outWin = toWineZPath(outLinux);
  const timeoutMs = opts.timeoutMs ?? 5000;

  let remoteDll = null;
  let remoteOut = null;
  let localMod = null;

  try {
    let remoteFnU32;
    const cached = injectCache.get(pid);
    if (cached) {
      remoteFnU32 = cached.remoteFnU32;
    } else {
      const k32 = kernel32.GetModuleHandleA('kernel32.dll');
      const loadLib = kernel32.GetProcAddress(k32, 'LoadLibraryA');
      if (!loadLib) throw new Error('GetProcAddress(LoadLibraryA) failed');

      remoteDll = allocWrite(hProcess, Buffer.from(`${dllWin}\0`, 'ascii'));
      const remoteModule = runRemote(hProcess, loadLib, remoteDll, timeoutMs);
      if (!remoteModule) {
        throw new Error(`LoadLibraryA in LM failed; dll=${dllWin}`);
      }

      localMod = kernel32.LoadLibraryA(dllWin);
      if (!localMod) {
        throw new Error(`local LoadLibraryA(${dllWin}) failed err=${kernel32.GetLastError()}`);
      }
      const localProc = kernel32.GetProcAddress(localMod, 'LmautoWriteMenuState');
      if (!localProc) {
        throw new Error('GetProcAddress(LmautoWriteMenuState) failed');
      }

      remoteFnU32 = (remoteModule + (addrU32(localProc) - addrU32(localMod))) >>> 0;
      injectCache.set(pid, { remoteModule, remoteFnU32 });
    }

    remoteOut = allocWrite(hProcess, Buffer.from(`${outWin}\0`, 'ascii'));
    const status = runRemote(hProcess, ptrFromU32(remoteFnU32), remoteOut, timeoutMs);
    if (status !== 0) {
      injectCache.delete(pid);
      throw new Error(`LmautoWriteMenuState returned ${status} (out=${outLinux})`);
    }
    if (!fs.existsSync(outLinux)) {
      throw new Error(`menu state file missing: ${outLinux}`);
    }
    const json = JSON.parse(fs.readFileSync(outLinux, 'utf8'));
    try {
      fs.unlinkSync(outLinux);
    } catch (_) {
      /* keep */
    }
    return json;
  } finally {
    if (remoteDll) kernel32.VirtualFreeEx(hProcess, remoteDll, 0n, MEM_RELEASE);
    if (remoteOut) kernel32.VirtualFreeEx(hProcess, remoteOut, 0n, MEM_RELEASE);
    if (localMod) kernel32.FreeLibrary(localMod);
    kernel32.CloseHandle(hProcess);
  }
}

function getCheckedFromSnapshot(snapshot, commandId) {
  if (!snapshot) return null;
  const k = String(commandId);
  if (!Object.prototype.hasOwnProperty.call(snapshot, k)) return null;
  return !!snapshot[k];
}

module.exports = {
  readMenuChecksInProcess,
  getCheckedFromSnapshot,
  dllPath,
  toWineZPath,
};
