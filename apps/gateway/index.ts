import { createServer, type IncomingMessage } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { isCredentialField, protect, redact } from '../../packages/core/index.ts';

export const requestLimit = 512 * 1024;
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const fields = new Set([
  'model', 'input', 'instructions', 'tools', 'tool_choice', 'parallel_tool_calls',
  'stream', 'store', 'reasoning', 'text', 'include', 'max_output_tokens',
  'temperature', 'top_p', 'truncation', 'service_tier', 'prompt_cache_key',
  'stream_options', 'prompt_cache_options', 'client_metadata', 'access_programs', 'request_country',
]);
const supportedTypes = new Set([
  'message', 'input_text', 'output_text', 'refusal', 'function', 'function_call',
  'function_call_output', 'reasoning', 'summary_text', 'text', 'json_schema',
  'json_object', 'string', 'object', 'number', 'integer', 'boolean', 'array', 'null',
  'custom', 'custom_tool_call', 'custom_tool_call_output', 'namespace', 'grammar', 'auto', 'none',
  'required', 'allowed_tools',
]);
const protectedFields = new Set(['instructions', 'input', 'content', 'text', 'refusal', 'output', 'description', 'summary']);

function contextLabel(field: string) {
  if (isCredentialField(field)) return field;
  const label = field.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').toLowerCase();
  if (isCredentialField(label) || /^(?:customer (?:id|number)|account (?:id|number)|aadhaar(?: number| id)?|phone(?: number)?|mobile(?: number)?|card(?: number)?|upi(?: id)?|(?:full|legal|patient|customer) name|(?:street|home|mailing|billing|shipping) address|date of birth|birth date|dob|ssn|social security number)$/.test(label)) return label;
}

export function sanitizeRequest(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_request');
  const request = body as Record<string, Json>;
  if (typeof request.model !== 'string' || !(typeof request.input === 'string' || Array.isArray(request.input))) throw new Error('invalid_request');
  if (Object.keys(request).some(key => !fields.has(key))) throw new Error('unsupported_request');
  const tokens = new Map<string, string>();
  function scan(value: string, mode: 'mask' | 'validate') {
    const result = protect(value, { strict: true, tokens });
    if (result.status !== 'ok' || (mode === 'validate' && result.findings.length)) throw new Error('protection_denied');
    return result.sanitizedText;
  }
  function sanitizeOutput(value: string, label?: string) {
    const prefix = label ? label + ': ' : '';
    const result = redact(prefix + value, { dotenv: true });
    if (result.status !== 'ok') throw new Error('protection_denied');
    return result.sanitizedText.slice(prefix.length);
  }
  function visit(value: Json, field: string, depth: number, toolData = false, toolOutput = false): Json {
    if (depth > 24) throw new Error('unsupported_request');
    const label = toolData ? contextLabel(field) : undefined;
    if (typeof value === 'string') {
      if (!toolData && field === 'arguments') {
        try {
          const parsed: Json = JSON.parse(value);
          if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
          return JSON.stringify(visit(parsed, '', depth + 1, true));
        } catch { throw new Error('protection_denied'); }
      }
      if (!toolData && field === 'output' && /^\s*[{[]/.test(value)) {
        let parsed: Json | undefined;
        try { parsed = JSON.parse(value); } catch { /* ordinary text */ }
        if (parsed !== undefined) return JSON.stringify(visit(parsed, '', depth + 1, true, toolOutput));
      }
      if (toolOutput) return sanitizeOutput(value, label);
      if (label) {
        const prefix = `${label}: `;
        return scan(prefix + value, 'mask').slice(prefix.length);
      }
      return scan(value, protectedFields.has(field) || toolData ? 'mask' : 'validate');
    }
    if (typeof value === 'number' && label) {
      if (toolOutput) {
        const protectedValue = sanitizeOutput(String(value), label);
        return protectedValue === String(value) ? value : protectedValue;
      }
      scan(`${label}: ${value}`, 'validate');
    }
    if (Array.isArray(value)) return value.map(item => visit(item, field, depth + 1, toolData, toolOutput));
    if (value && typeof value === 'object') {
      if ((!toolData && typeof value.type === 'string' && !supportedTypes.has(value.type)) || Object.hasOwn(value, 'encrypted_content')) throw new Error('unsupported_request');
      const environmentMap = toolOutput && /^(?:env|environ|environment|env[_-]?vars|environment[_-]?variables)$/i.test(field);
      return Object.fromEntries(Object.entries(value).map(([key, child]) => {
        scan(key, 'validate');
        if (environmentMap && (typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean')) {
          return [key, child === '' ? child : '[PV_REDACTED]'];
        }
        const outputField = key === 'output' && (value.type === 'function_call_output' || value.type === 'custom_tool_call_output');
        if (toolOutput && ['type', 'role'].includes(key) && typeof child === 'string') return [key, scan(child, 'validate')];
        return [key, visit(child, key, depth + 1, toolData || field === 'output', toolOutput || outputField)];
      }));
    }
    return value;
  }
  if (request.include !== undefined && (!Array.isArray(request.include)
    || request.include.some(item => item !== 'reasoning.encrypted_content'))) throw new Error('unsupported_request');
  const { include: _include, ...visible } = request;
  return { ...(visit(visible, '', 0) as object), store: false };
}

export async function readBody(input: AsyncIterable<Buffer | string>, limit = requestLimit) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of input) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new Error('input_too_large');
    chunks.push(buffer);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}

function authorized(request: IncomingMessage, token: string) {
  const actual = Buffer.from(request.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createGateway({ token, apiKey, forward = fetch }: { token: string; apiKey: string; forward?: typeof fetch }) {
  if (!token || !apiKey || token === apiKey) throw new Error('Separate gateway credentials are required.');
  const server = createServer({ requestTimeout: 30_000 }, async (request, response) => {
    const fail = (status: number, code: string) => {
      if (response.destroyed) return;
      if (response.headersSent) { response.destroy(); return; }
      response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ error: { message: code, code } }));
    };
    const address = request.socket.localPort;
    if (request.headers.host !== `127.0.0.1:${address}` || request.headers.origin) return fail(403, 'invalid_origin');
    if (!authorized(request, token)) return fail(401, 'unauthorized');
    if (request.method !== 'POST' || request.url !== '/v1/responses') return fail(404, 'unsupported_route');
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) return fail(415, 'unsupported_media_type');
    let sanitized: object;
    try {
      sanitized = sanitizeRequest(JSON.parse(await readBody(request)));
    } catch {
      return fail(422, 'request_not_forwarded');
    }
    const abort = new AbortController();
    response.once('close', () => abort.abort());
    try {
      const upstream = await forward('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(sanitized),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(120_000)]),
        redirect: 'error',
      });
      if (!upstream.ok) { await upstream.body?.cancel(); return fail(upstream.status, 'upstream_error'); }
      const type = upstream.headers.get('content-type') ?? '';
      if (!/^(application\/json|text\/event-stream)(?:;|$)/i.test(type)) { await upstream.body?.cancel(); return fail(502, 'invalid_upstream_type'); }
      response.writeHead(upstream.status, { 'content-type': type, 'cache-control': 'no-store' });
      if (upstream.body) {
        const body = upstream.body;
        async function* chunks() {
          const reader = body.getReader();
          try {
            for (;;) {
              const item = await reader.read();
              if (item.done) return;
              yield item.value;
            }
          } finally {
            await reader.cancel().catch(() => {});
            reader.releaseLock();
          }
        }
        await pipeline(chunks(), response);
      } else response.end();
    } catch {
      fail(502, 'upstream_error');
    }
  });
  server.headersTimeout = 10_000;
  return server;
}

export function gatewayPort() {
  const port = Number(process.env.PROMPTVEIL_PORT ?? '8787');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PROMPTVEIL_PORT.');
  return port;
}

export function startGateway() {
  const token = process.env.PROMPTVEIL_GATEWAY_TOKEN;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Set OPENAI_API_KEY before starting the gateway.');
  if (!token || token.length < 32) throw new Error('Set a random PROMPTVEIL_GATEWAY_TOKEN before starting the gateway.');
  const port = gatewayPort();
  const server = createGateway({ token, apiKey });
  server.on('error', () => { process.stderr.write('PromptVeil gateway could not bind.\n'); process.exitCode = 3; });
  server.listen(port, '127.0.0.1', () => process.stderr.write(`PromptVeil gateway listening on 127.0.0.1:${port}\n`));
}
