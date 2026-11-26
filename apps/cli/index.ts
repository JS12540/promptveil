#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { parseArgs } from 'node:util';
import { maxInput, protect, redact } from '../../packages/core/index.ts';
import { gatewayPort, readBody, startGateway } from '../gateway/index.ts';
import { renderRelayProfile } from '../../adapters/codex/index.ts';
import { configure, guard } from './agents.ts';

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help') {
    console.log('PromptVeil\n  protect [--strict | --redact | --dotenv | --config]\n  scan [--file PATH] [--json] [--strict]\n  install|uninstall|doctor claude-code|codex|cursor|gemini [--apply]\n  gateway\n  profile codex');
    return;
  }
  if (command === 'hook') {
    try { console.log(JSON.stringify(guard(args[0], await readBody(process.stdin)))); }
    catch { console.log(JSON.stringify(guard(args[0], ''))); }
    return;
  }
  if (command === 'gateway' && args.length === 0) return startGateway();
  if (command === 'profile' && args.length === 1 && args[0] === 'codex') {
    process.stdout.write(renderRelayProfile(gatewayPort()));
    return;
  }
  if (command === 'install' || command === 'uninstall' || command === 'doctor') {
    const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { apply: { type: 'boolean' } } });
    if (positionals.length !== 1) throw new Error('Specify an agent.');
    console.log(await configure(positionals[0], command, values.apply ?? false));
    return;
  }
  if (command !== 'protect' && command !== 'scan') throw new Error('Unknown command. Use --help.');
  const { values } = parseArgs({ args, options: {
    strict: { type: 'boolean' }, ...(command === 'scan'
      ? { file: { type: 'string' }, json: { type: 'boolean' } }
      : { redact: { type: 'boolean' }, dotenv: { type: 'boolean' }, config: { type: 'boolean' } }),
  } });
  const input = 'file' in values && typeof values.file === 'string' ? createReadStream(values.file) : process.stdin;
  const dotenv = 'dotenv' in values && values.dotenv === true;
  const config = 'config' in values && values.config === true;
  const mask = config || dotenv || ('redact' in values && values.redact === true);
  if (values.strict && mask) throw new Error('Choose one protection policy.');
  const text = await readBody(input, maxInput * 4);
  const result = mask ? redact(text, { dotenv, config }) : protect(text, { strict: values.strict });
  if (command === 'scan') {
    const { status, findings } = result;
    console.log('json' in values && values.json ? JSON.stringify({ status, findings }) : `${status}: ${findings.length} finding(s)`);
  } else if (result.status === 'ok') {
    process.stdout.write(result.sanitizedText);
  }
  if (result.status !== 'ok') {
    process.stderr.write(`PromptVeil: ${result.status}\n`);
    process.exitCode = result.status === 'error' ? 3 : 2;
  }
}

main().catch(() => {
  process.stderr.write('PromptVeil could not complete the command. Check --help and configuration.\n');
  process.exitCode = 3;
});
