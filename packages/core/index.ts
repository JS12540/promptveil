import type { Action, Finding, Result, Review } from '../contracts/index.ts';

export const maxInput = 65_536;
type Rule = [type: string, action: Action, pattern: RegExp, capture?: true | number, validate?: (value: string, match: RegExpExecArray) => boolean];
const credentialLabel = '(?:password|passwd|passphrase|token|secret|(?:api|access|secret|account|subscription|private|encryption|signing)[_ -]?key|(?:access|auth|bearer|refresh|session|personal[_ -]?access)[_ -]?token|(?:client|api|app|webhook|signing|consumer|access[_ -]?key)[_ -]?secret|secret[_ -]?access[_ -]?key)';
const credentialField = '(?:[a-z][a-z0-9]{0,31}[_-]){0,4}' + credentialLabel;
const credentialFieldPattern = new RegExp('^' + credentialField + '$', 'i');
export const isCredentialField = (label: string) => credentialFieldPattern.test(label);
const assignment = '(?:=>|:=|=(?!=)|:(?!:))[ \\t]{0,12}';
const credentialPrefix = '(?<![\\w-])' + credentialField + '["\']?[\\]\\x20\\t]{0,8}(?::[ \\t]*[a-z][\\w.<>?]{0,63}(?:\\[\\])?[ \\t]*=(?!=)[ \\t]*|' + assignment + ')';
const credentialAssignment = new RegExp(credentialPrefix + '["\']?([^\\s"\'<>;,]{4,256})', 'gi');
const credentialStart = new RegExp(credentialPrefix, 'gi');
const dotenvStart = /^(?:[ \t]*\d+(?:[ \t]*[|:][ \t]*|\t+))?[ \t]*(?:export[ \t]+)?[a-z_][a-z0-9_]*[ \t]*=[ \t]*(?!=)/gim;
const configStart = /^[ \t]*(?:-[ \t]+)?(?:["'][\w.-]+["']|[a-z_][\w.-]*)[ \t]*(?:=(?!=)|:[ \t])([ \t]*)/gim;
const environmentWrite = /\b(?:(?:process\.env|os\.environ|ENV)(?:\.[a-z_]\w*|\[[ \t]*["'][a-z_]\w*["'][ \t]*\])|env:[a-z_]\w*)[ \t]*=(?!=)[ \t]*/gi;
const environmentSetter = /\b(?:setenv|os\.Setenv|std::env::set_var|Environment\.SetEnvironmentVariable|System\.setProperty)\([ \t]*["'][a-z_][\w.-]*["'][ \t]*,[ \t]*(?=["'`])/gi;
const containerEnv = /^[ \t]*(?:ENV|ARG)[ \t]+[A-Z_][A-Z0-9_]*[ \t]*(?:=(?!=)[ \t]*|[ \t]+(?=\S))/gm;
const yamlEnvValue = new RegExp('^[ \\t]*-[ \\t]+name:[ \\t]*["\']?' + credentialField + '["\']?[ \\t]*\\r?\\n[ \\t]+value:[ \\t]*', 'gim');
const jsonToken = /"(?:[^"\\]|\\.)*"|-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|true|false|null|[{}[\]:,]/g;
const envName = '[a-z_][a-z0-9_]*';
const envReference = new RegExp('^(?:[$](?:env:' + envName + '|\\{(?:env[.:])?' + envName + '\\}|' + envName + ')|%' + envName + '%|(?:process\\.env|os\\.environ|ENV)(?:\\.' + envName + '|\\[["\']' + envName + '["\']\\])|(?:os\\.(?:getenv|environ\\.get)|System\\.getenv|Environment\\.GetEnvironmentVariable|ENV\\.fetch|std::env::var|getenv|env!)\\(["\']' + envName + '["\']\\))$', 'i');

function isCredentialValue(value: string) {
  return !envReference.test(value) && !/^(?:YOUR_[A-Z_]+|CHANGE_?ME|PLACEHOLDER|EXAMPLE|REDACTED|NONE|NULL|\[PV_REDACTED\])$/i.test(value);
}

function isLiteralAssignment(value: string, match: RegExpExecArray) {
  if (!isCredentialValue(value)) return false;
  if (!/[([]$/.test(value)) return true;
  const start = match.index + match[0].length - value.length;
  const expression = match.input.slice(start, endOfLine(match.input, start)).trim().replace(/;$/, '').trimEnd();
  return !envReference.test(expression);
}

function isCustomerLabel(label: string) {
  const expected = 'customer';
  const word = label.toLowerCase();
  let i = 0;
  while (i < word.length && word[i] === expected[i]) i++;
  if (word.length < expected.length) return word.slice(i) === expected.slice(i + 1);
  if (word.length > expected.length) return word.slice(i + 1) === expected.slice(i);
  if (word.slice(i + 1) === expected.slice(i + 1)) return true;
  return word[i] === expected[i + 1] && word[i + 1] === expected[i] && word.slice(i + 2) === expected.slice(i + 2);
}

function luhn(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19 || new Set(digits).size === 1) return false;
  let sum = 0;
  for (let index = 0; index < digits.length; index++) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2) digit = digit * 2 > 9 ? digit * 2 - 9 : digit * 2;
    sum += digit;
  }
  return sum % 10 === 0;
}

const rules: Rule[] = [
  ['private_key', 'block', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g],
  ['token', 'block', /\b(?:sk-(?:proj-)?[\w-]{20,200}|gh[pousr]_[a-zA-Z0-9]{20,255}|AKIA[A-Z0-9]{16}|eyJ[\w-]{5,500}\.[\w-]{5,1000}\.[\w-]{5,500})\b/g],
  ['database_credential', 'block', /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@/]{1,128}:[^\s@/]{1,256}@/gi],
  ['credential', 'block', credentialAssignment, true, isLiteralAssignment],
  ['credential', 'block', /\bauthorization["']?[ \t]*:[ \t]*["']?(?:bearer|basic)[ \t]+([a-z0-9._~+/=-]{6,256})/gi, true, isCredentialValue],
  ['upi', 'mask', /\b(?:upi(?:\s+id)?\s*[:=]|pay\s+to)\s*([\w.-]{2,64}@[a-z]{2,30})\b/gi, true],
  ['email', 'mask', /\b[\w.!#$%&'*+/=?^`{|}~-]{1,64}@[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63}){0,4}\.[a-z]{2,24}\b/gi],
  ['pan', 'mask', /\b[A-Z]{5}\d{4}[A-Z]\b/g],
  ['aadhaar', 'mask', /\baadhaar(?:\s+(?:number|id))?(?:\s+is|\s*[:=])\s*([2-9]\d{3}[ -]?\d{4}[ -]?\d{4})(?!\d)/gi, true],
  ['customer_id', 'mask', /\b([a-z]{7,9})\s+(?:id|number)(?:\s+is|\s*[:=])\s*([\w-]{4,64})\b/gi, 2, (value, match) => /\d/.test(value) && isCustomerLabel(match[1])],
  ['account_id', 'mask', /\baccount\s+(?:id|number)(?:\s+is|\s*[:=])\s*([\w-]{6,64})\b/gi, true, value => /\d/.test(value)],
  ['phone', 'mask', /\b(?:phone|mobile|tel)(?:\s+number)?(?:\s+is|\s*[:=])\s*(\+?[0-9][0-9 ().-]{6,20}[0-9])(?!\d)/gi, true, value => { const size = value.replace(/\D/g, '').length; return size >= 8 && size <= 15; }],
  ['person_name', 'mask', /\b(?:full|legal|patient|customer)[ _-]+name["']?[ \t]*[:=][ \t]*["']?([\p{L}\p{M}][\p{L}\p{M}.'’ -]{1,100}[\p{L}\p{M}.])/giu, true],
  ['street_address', 'mask', /\b(?:street|home|mailing|billing|shipping)[ _-]+address["']?[ \t]*[:=][ \t]*["']?(\d[\p{L}\p{M}\d .,'’#/-]{4,150})/giu, true, value => /\p{L}/u.test(value)],
  ['date_of_birth', 'mask', /\b(?:date[ _-]+of[ _-]+birth|birth[ _-]+date|dob)["']?[ \t]*[:=][ \t]*["']?(\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4})\b/gi, true],
  ['ssn', 'mask', /\b(?:ssn|social[ _-]+security[ _-]+(?:number|no))["']?[ \t]*[:=][ \t]*["']?(\d{3}[- ]?\d{2}[- ]?\d{4})\b/gi, true],
  ['card', 'mask', /\b(?:card(?:\s+number)?)(?:\s+is|\s*[:=])\s*(\d(?:[ -]?\d){12,18})(?!\d)/gi, true, luhn],
  ['bank_routing', 'review', /\bIFSC\s*[:=]\s*([A-Z]{4}0[A-Z0-9]{6})\b/gi, true],
];
const priority = { review: 0, mask: 1, block: 2 };

function normalizeDigits(text: string) {
  return text.replace(/[٠-٩۰-۹०-९০-৯０-９]/g, digit => String(digit.charCodeAt(0) - (
    digit <= '٩' ? 0x660 : digit <= '۹' ? 0x6f0 : digit <= '९' ? 0x966 : digit <= '৯' ? 0x9e6 : 0xff10
  )));
}

function detect(text: string, redactAssignments = false) {
  const candidates: Finding[] = [];
  const normalized = normalizeDigits(text);
  for (const [type, action, pattern, capture, validate] of rules) {
    if (redactAssignments && pattern === credentialAssignment) continue;
    for (const match of normalized.matchAll(pattern)) {
      const value = match[typeof capture === 'number' ? capture : capture ? 1 : 0];
      if (validate && !validate(value, match)) continue;
      const end = match.index + match[0].length;
      candidates.push({ start: end - value.length, end, type, action, evidenceCodes: [`${type}_rule`] });
    }
  }
  return candidates;
}

function endOfLine(text: string, start: number) {
  const nextLine = text.indexOf('\n', start);
  const end = nextLine < 0 ? text.length : nextLine;
  return end > start && text[end - 1] === '\r' ? end - 1 : end;
}

function endOfBlock(text: string, lineStart: number, start: number, end: number) {
  if (!/^[|>](?:[1-9][+-]?|[+-][1-9]?)?(?:[ \t]+#.*)?[ \t]*$/.test(text.slice(start, end))) return end;
  const indent = text.slice(lineStart).match(/^[ \t]*/)?.[0].length ?? 0;
  let last = end;
  for (let next = text.indexOf('\n', end); next >= 0 && next + 1 < text.length;) {
    const lineEnd = endOfLine(text, next + 1);
    const line = text.slice(next + 1, lineEnd);
    if (line.trim() && (line.match(/^[ \t]*/)?.[0].length ?? 0) <= indent) break;
    last = lineEnd;
    next = text.indexOf('\n', lineEnd);
  }
  return last;
}

function endOfValue(text: string, start: number, lineStart: number, entireLine: boolean) {
  const quote = text[start];
  if (quote !== '"' && quote !== "'" && quote !== '`') {
    if (quote === '\r' || quote === '\n') return start;
    let end = endOfLine(text, start);
    while (text[end - 1] === '\\') {
      const newline = text.indexOf('\n', end);
      if (newline < 0) break;
      end = endOfLine(text, newline + 1);
    }
    return endOfBlock(text, lineStart, start, end);
  }
  const delimiter = text.startsWith(quote.repeat(3), start) ? quote.repeat(3) : quote;
  for (let i = start + delimiter.length; i < text.length; i++) {
    if (quote === "'" && delimiter.length === 1 && text.startsWith("''", i)) { i++; continue; }
    if (text.startsWith(delimiter, i)) {
      const end = i + delimiter.length;
      return entireLine ? endOfLine(text, end) : end;
    }
    if (text[i] === '\\') i++;
  }
  return text.length;
}

function jsonRedactions(text: string, config: boolean) {
  const matches: Finding[] = [];
  const scopes: boolean[] = [];
  let sensitiveKey = false;
  for (const match of text.matchAll(jsonToken)) {
    const [token] = match;
    const start = match.index;
    const end = start + token.length;
    if (token === ':' || token === ',') continue;
    if (token === '}' || token === ']') { scopes.pop(); continue; }
    if (token === '{' || token === '[') {
      scopes.push(sensitiveKey || scopes.at(-1) === true);
      sensitiveKey = false;
      continue;
    }
    const value = JSON.parse(token);
    let next = end;
    while (/\s/.test(text[next] ?? '')) next++;
    if (typeof value === 'string' && text[next] === ':') {
      sensitiveKey = isCredentialField(value);
      continue;
    }
    const sensitive = sensitiveKey || scopes.at(-1) === true;
    sensitiveKey = false;
    if (!config && !(sensitive && (typeof value !== 'string' || isCredentialValue(value)))) {
      if (sensitive || typeof value !== 'string' ||
        !redact(value).findings.some(({ type }) => /^(credential|environment_value|private_key|token|database_credential|json_value)$/.test(type))) continue;
    }
    matches.push({ start, end, type: 'json_value', action: 'block', evidenceCodes: ['json_value_redaction'] });
  }
  return matches;
}

export function redact(text: string, { dotenv = false, config = false, tokens }: {
  dotenv?: boolean; config?: boolean; tokens?: Map<string, string>;
} = {}): Result {
  if (text.length > maxInput) return { status: 'error', findings: [] };
  const candidates = detect(text, true);
  for (const finding of candidates) {
    if (finding.type !== 'private_key') continue;
    const kind = text.slice(finding.start + '-----BEGIN '.length, finding.end - 5);
    const footer = `-----END ${kind}-----`;
    const end = text.indexOf(footer, finding.end);
    finding.end = end < 0 ? text.length : end + footer.length;
  }
  let json = false;
  if (/^\s*[{[]/.test(text)) {
    try { JSON.parse(text); json = true; } catch { /* Mixed text uses assignment matching. */ }
  }
  const jsonFindings = json ? jsonRedactions(text, config) : [];
  candidates.push(...jsonFindings);
  const quoteReplacements = new Set(jsonFindings.map(finding => finding.start));
  const patterns = json
    ? []
    : [[credentialStart, 'credential'], [environmentWrite, 'environment_value'], [environmentSetter, 'environment_value'],
      [containerEnv, 'environment_value'], [yamlEnvValue, 'credential'],
      ...(dotenv || config ? [[dotenvStart, 'dotenv_value']] as const : []),
      ...(config ? [[configStart, 'config_value']] as const : [])] as const;
  for (const [pattern, type] of patterns) {
    let consumed = 0;
    for (const match of text.matchAll(pattern)) {
      let start = match.index + match[0].length;
      if (start < consumed) continue;
      const lineStart = text.lastIndexOf('\n', match.index - 1) + 1;
      let end = endOfValue(text, start, lineStart, type === 'dotenv_value');
      const raw = text.slice(start, end).trim().replace(/;$/, '').trimEnd();
      if (/^[{[]\s*$/.test(raw) && type === 'config_value') continue;
      const unquoted = raw.replace(/^(['"])(.*)\1$/, '$2');
      if (!config && type !== 'dotenv_value' && !isCredentialValue(unquoted)) continue;
      if ((type === 'environment_value' || (type === 'credential' && match[0].includes('='))) && /^['"`]/.test(text[start]) &&
        text[end - 1] === text[start] && end - start > 2) {
        const width = text.startsWith(text[start].repeat(3), start) ? 3 : 1;
        if (end - start > width * 2) { start += width; end -= width; }
      }
      if (end <= start || !text.slice(start, end).trim()) continue;
      candidates.push({ start, end, type, action: 'block', evidenceCodes: [`${type}_redaction`] });
      consumed = end;
    }
  }
  candidates.sort((a, b) => a.start - b.start || b.end - a.end);
  const findings: Finding[] = [];
  const output: string[] = [];
  let cursor = 0;
  for (const candidate of candidates) {
    const previous = findings.at(-1);
    if (previous && candidate.start < previous.end) {
      previous.end = Math.max(previous.end, candidate.end);
      if (candidate.action !== 'mask') previous.action = 'block';
      continue;
    }
    findings.push(candidate);
  }
  const used = new Set(tokens?.values());
  for (const finding of findings) {
    const replacement = tokens && finding.action === 'mask'
      ? placeholder(finding, text, tokens, used)
      : '[PV_REDACTED]';
    output.push(text.slice(cursor, finding.start), quoteReplacements.has(finding.start) ? JSON.stringify(replacement) : replacement);
    cursor = finding.end;
    finding.action = 'mask';
  }
  output.push(text.slice(cursor));
  return { status: 'ok', findings, sanitizedText: output.join('') };
}

function placeholder(item: Finding, text: string, tokens: Map<string, string>, used: Set<string>) {
  const key = `${item.type}: ${text.slice(item.start, item.end)}`;
  let token = tokens.get(key);
  if (!token || text.includes(token)) {
    do token = `[PV_${item.type.toUpperCase()}_${crypto.randomUUID()}]`; while (used.has(token) || text.includes(token));
    tokens.set(key, token);
    used.add(token);
  }
  return token;
}

export function protect(text: string, { strict = false, decisions = {}, tokens = new Map<string, string>() }: {
  strict?: boolean; decisions?: Review; tokens?: Map<string, string>;
} = {}): Result {
  if (text.length > maxInput) return { status: 'error', findings: [] };
  const candidates = detect(text).sort((a, b) => priority[b.action] - priority[a.action] || a.start - b.start || b.end - a.end);
  const findings: Finding[] = [];
  const occupied = new Uint8Array(text.length);
  for (const candidate of candidates) {
    let overlap = false;
    for (let position = candidate.start; position < candidate.end; position++) {
      if (occupied[position]) { overlap = true; break; }
    }
    if (overlap) continue;
    occupied.fill(1, candidate.start, candidate.end);
    findings.push(candidate);
  }
  findings.sort((a, b) => a.start - b.start);
  if (findings.some(item => item.action === 'block')) return { status: 'blocked', findings };
  if (findings.some(item => item.action === 'review' && !['mask', 'allow'].includes(decisions[item.start]))) return { status: strict ? 'blocked' : 'review', findings };
  let sanitizedText = text;
  const used = new Set(tokens.values());
  for (const item of [...findings].reverse()) {
    if (item.action === 'review' && decisions[item.start] === 'allow') continue;
    const token = placeholder(item, text, tokens, used);
    sanitizedText = sanitizedText.slice(0, item.start) + token + sanitizedText.slice(item.end);
  }
  return { status: 'ok', findings, sanitizedText };
}
