// Keep customer credentials out of Codex's shell environment. Its own login is read from CODEX_HOME
// (or the normal per-user Codex directory); HQ credentials are forwarded only to the HQ MCP child.
export const CODEX = process.env.CODEX_BIN || 'codex';

const WIN_ENV = ['PATH', 'PATHEXT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'HOME', 'CODEX_HOME'];
const UNIX_ENV = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'CODEX_HOME'];

export function codexEnv(extra = {}) {
  const keys = process.platform === 'win32' ? WIN_ENV : UNIX_ENV;
  return { ...Object.fromEntries(keys.filter((key) => process.env[key]).map((key) => [key, process.env[key]])), ...extra };
}
