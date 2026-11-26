import { readFile, lstat, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudeCode } from '../../adapters/claude-code/index.ts';
import { codex } from '../../adapters/codex/index.ts';
import { cursor } from '../../adapters/cursor/index.ts';
import { gemini } from '../../adapters/gemini/index.ts';
import { protect } from '../../packages/core/index.ts';

const adapters = { 'claude-code': claudeCode, codex, cursor, gemini };

function agent(name: string): keyof typeof adapters {
  if (!Object.hasOwn(adapters, name)) throw new Error('Unsupported agent.');
  return name as keyof typeof adapters;
}

const eventNames = { 'claude-code': 'UserPromptSubmit', codex: 'UserPromptSubmit', cursor: 'beforeSubmitPrompt', gemini: 'BeforeAgent' };

function quote(value: string) {
  if (/[\r\n\0]/.test(value)) throw new Error('Unsupported executable path.');
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

export function guard(agentName: string, body: string) {
  const name = agent(agentName);
  const adapter = adapters[name];
  try {
    const event = JSON.parse(body);
    if (typeof event?.prompt !== 'string' || (name !== 'cursor' && event.hook_event_name !== eventNames[name])) throw new Error();
    const result = protect(event.prompt);
    if (result.status === 'ok' && !result.findings.length) return name === 'cursor' ? cursor.allow : {};
  } catch {
    return adapter.block('PromptVeil could not verify this prompt.');
  }
  return adapter.block('PromptVeil flagged this prompt. Protect the input locally and resubmit.');
}

export async function configure(agentName: string, action: 'install' | 'uninstall' | 'doctor', apply: boolean) {
  if (process.platform === 'win32') throw new Error('Native installer requires a POSIX shell. The CLI and gateway support Windows.');
  const name = agent(agentName);
  const adapter = adapters[name];
  const configHome = name === 'codex' ? process.env.CODEX_HOME : name === 'claude-code' ? process.env.CLAUDE_CONFIG_DIR : undefined;
  const isCursor = name === 'cursor';
  const eventName = eventNames[name];
  const path = configHome
    ? join(configHome, name === 'codex' ? 'hooks.json' : 'settings.json')
    : join((name === 'gemini' && process.env.GEMINI_CLI_HOME) || homedir(), adapter.config);
  const cli = fileURLToPath(new URL(import.meta.url.endsWith('.ts') ? './index.ts' : './index.js', import.meta.url));
  const command = [process.execPath, '--experimental-strip-types', cli, 'hook', name, '--promptveil-managed'].map(quote).join(' ');
  const marker = ` ${quote('--promptveil-managed')}`;
  const owns = (hook: { command?: string }) => typeof hook.command === 'string' && hook.command.endsWith(marker);
  const handler = { type: 'command', command, timeout: name === 'gemini' ? 5000 : 5 };
  let original: string | undefined;
  try {
    if (!(await lstat(path)).isFile()) throw new Error();
    original = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Cannot safely read agent config.');
  }
  const config = JSON.parse(original ?? '{}');
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Invalid agent config.');
  if (config.hooks !== undefined && (!config.hooks || typeof config.hooks !== 'object' || Array.isArray(config.hooks))) throw new Error('Invalid agent hooks.');
  if (isCursor && config.version !== undefined && config.version !== 1) throw new Error('Unsupported Cursor hook config version.');
  const entries = config.hooks?.[eventName] ?? [];
  const isHook = (hook: unknown) => hook && typeof hook === 'object' && !Array.isArray(hook);
  if (!Array.isArray(entries) || !entries.every(entry => isHook(entry) &&
    (isCursor || (Array.isArray(entry.hooks) && entry.hooks.every(isHook))))) throw new Error('Invalid prompt hooks.');
  const owned = (isCursor ? entries : entries.flatMap(group => group.hooks)).filter(owns);
  if (action === 'doctor') {
    if (name === 'gemini' && (config.hooksConfig?.enabled === false ||
      (Array.isArray(config.hooksConfig?.disabled) && config.hooksConfig.disabled.includes(command)))) {
      return 'Gemini CLI hook execution is disabled in user settings.';
    }
    return owned.some(hook => hook.command === command) ? 'Prompt guard configured. Verify agent trust and run the documented smoke test.' : 'Prompt guard missing or executable path changed.';
  }
  if ((action === 'uninstall' && owned.length === 0) || (action === 'install' && owned.length === 1 && owned[0].command === command)) return 'No change required.';
  if (!apply) return `Preview: ${action === 'install' ? 'add or update' : 'remove'} the PromptVeil ${eventName} hook. Existing hooks are preserved. Use --apply to write.`;
  const next = isCursor ? entries.filter(entry => !owns(entry)) : entries.flatMap(group => {
    const hooks = group.hooks.filter((hook: { command?: string }) => !owns(hook));
    return hooks.length || !group.hooks.length ? [{ ...group, hooks }] : [];
  });
  if (action === 'install') {
    if (isCursor) {
      config.version ??= 1;
      next.push({ ...handler, failClosed: true });
    } else {
      next.push({ hooks: [handler] });
    }
  }
  config.hooks = { ...config.hooks, [eventName]: next };
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const lock = resolve(`${path}.promptveil.lock`);
  const temporary = `${path}.promptveil-${crypto.randomUUID()}.tmp`;
  await writeFile(lock, '', { flag: 'wx', mode: 0o600 });
  try {
    const latest = await readFile(path, 'utf8').catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (latest !== original) throw new Error('Agent configuration changed. Retry the preview.');
    if (original !== undefined) await writeFile(`${temporary}.backup`, original, { flag: 'wx', mode: 0o600 });
    await writeFile(temporary, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(() => {});
    await unlink(lock);
  }
  return 'Agent configuration updated.';
}
