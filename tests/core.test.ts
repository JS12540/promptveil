import assert from 'node:assert/strict';
import { test } from 'node:test';
import { maxInput, protect, redact } from '../packages/core/index.ts';

test('preserves ordinary monetary amounts and source placeholders', () => {
  const text = 'Calculate returns on ₹25,000 or USD 25000. class CustomerID: pass. API_KEY=YOUR_API_KEY';
  assert.deepEqual(protect(text), { status: 'ok', findings: [], sanitizedText: text });
});

test('masks only the labeled customer identifier, using UTF-16 offsets', () => {
  const value = '12345678';
  const text = `🧪 Customer ID: ${value}; amount ₹25,000.`;
  const result = protect(text);
  assert.equal(result.status, 'ok');
  assert.equal(result.findings.length, 1);
  const [finding] = result.findings;
  assert.deepEqual(finding, {
    start: text.indexOf(value),
    end: text.indexOf(value) + value.length,
    type: 'customer_id',
    action: 'mask',
    evidenceCodes: ['customer_id_rule'],
  });
  assert.match(result.sanitizedText, /^🧪 Customer ID: \[PV_CUSTOMER_ID_[a-z0-9-]+\]; amount ₹25,000\.$/);
});

test('blocks a supported credential alongside an unrelated currency value', () => {
  const result = protect('Invest ₹25,000; password: synthetic-never-valid.');
  assert.equal(result.status, 'blocked');
  assert.equal(result.findings[0].action, 'block');
  assert.equal('sanitizedText' in result, false);
});

test('masks customer IDs with a single typo in the label and preserves unrelated numbers', () => {
  const labels = ['Cutomer id : ', 'Cusotmer id : ', 'Cusstomer number = ', 'Custxmer ID is '];
  const values = ['1234', '1234455', '76291483', 'AB-7350'];
  const ordinary = 'Consumer ID: 6473182. Customer number is optional. Invest ₹25,000 at 2.5%.';
  const text = [...labels.map((label, index) => label + values[index]), ordinary].join('\n');
  const result = protect(text);
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.findings.map(({ start, end }) => text.slice(start, end)), values);
  assert.deepEqual(result.sanitizedText.replace(/\[PV_CUSTOMER_ID_[a-f0-9-]+\]/g, '[masked]').split('\n'),
    [...labels.map(label => label + '[masked]'), ordinary]);
});

test('generalizes customer label matching across every generated single edit', () => {
  const word = 'customer';
  const spellings = new Set([word]);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i <= word.length; i++) {
    const prefix = word.slice(0, i);
    const suffix = word.slice(i);
    for (const letter of alphabet) {
      spellings.add(prefix + letter + suffix);
      if (suffix) spellings.add(prefix + letter + suffix.slice(1));
    }
    if (suffix) spellings.add(prefix + suffix.slice(1));
    if (suffix.length >= 2) spellings.add(prefix + suffix[1] + suffix[0] + suffix.slice(2));
  }
  for (const spelling of spellings) {
    const result = protect(`${spelling} ID: 73918426`);
    assert.equal(result.findings[0]?.type, 'customer_id', spelling);
  }
});

test('masks labeled PII and blocks contextual credentials across providers', () => {
  const result = protect('Patient name: Noor Example\nMailing address: 752 Test Lane\nDOB: 1987-04-21\nSSN: 000-12-3456\nInvest ₹25,000.');
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.findings.map(finding => finding.type), ['person_name', 'street_address', 'date_of_birth', 'ssn']);
  assert.doesNotMatch(result.sanitizedText, /Noor Example|752 Test Lane|1987-04-21|000-12-3456/);
  assert.match(result.sanitizedText, /₹25,000/);
  for (const text of ['ACME_API_KEY="fixture-never-valid"', '{"clientSecret":"fixture-never-valid"}', 'Authorization: Bearer fixture-never-valid', 'MY_SERVICE_REFRESH_TOKEN=fixture-never-valid']) {
    assert.equal(protect(text).status, 'blocked');
  }
  const settings = 'APP_API_KEY=${APP_API_KEY}\nAPI_VERSION=2026-11-25\nPUBLIC_KEY=synthetic-public-value\nReport date: 1987-04-21';
  assert.deepEqual(protect(settings), { status: 'ok', findings: [], sanitizedText: settings });
});

test('redaction removes complete credential spans and dotenv assignment values', () => {
  const text = [
    'Password: "a fake multiword value"',
    '-----BEGIN PRIVATE KEY-----',
    'synthetic-pem-body',
    '-----END PRIVATE KEY-----',
    '12 | export CUSTOM_SETTING="synthetic first line',
    'synthetic second line"',
    'EMPTY=',
    'Invest ₹25,000.',
  ].join('\n');
  const result = redact(text, { dotenv: true });
  assert.equal(result.status, 'ok');
  assert.equal(result.sanitizedText, [
    'Password: [PV_REDACTED]', '[PV_REDACTED]',
    '12 | export CUSTOM_SETTING=[PV_REDACTED]', 'EMPTY=', 'Invest ₹25,000.',
  ].join('\n'));
  assert.equal(protect(text).status, 'blocked');
  const truncated = redact('-----BEGIN PRIVATE KEY-----\ntruncated synthetic body');
  assert.equal(truncated.status, 'ok');
  assert.equal(truncated.sanitizedText, '[PV_REDACTED]');
});

test('minimizes cross-language source and config without leaking literal credential values', () => {
  const cases = [
    ['const apiKey: string = "fixture-token"; renderPage();', 'const apiKey: string = "[PV_REDACTED]"; renderPage();'],
    ['os.environ["CUSTOM"] = "fixture-token"', 'os.environ["CUSTOM"] = "[PV_REDACTED]"'],
    ['$env:CUSTOM = "fixture-token"', '$env:CUSTOM = "[PV_REDACTED]"'],
    ['os.Setenv("CUSTOM", "fixture-token")', 'os.Setenv("CUSTOM", "[PV_REDACTED]")'],
    ['apiKey := "fixture-token"', 'apiKey := "[PV_REDACTED]"'],
    ['val clientSecret = "fixture-token"', 'val clientSecret = "[PV_REDACTED]"'],
    ['"client_secret" => "fixture-token",', '"client_secret" => "[PV_REDACTED]",'],
    ['ENV CUSTOM=fixture-token\nEXPOSE 8080', 'ENV CUSTOM=[PV_REDACTED]\nEXPOSE 8080'],
    ['env:\n  - name: API_KEY\n    value: fixture-token\n  - name: PORT\n    value: 8080', 'env:\n  - name: API_KEY\n    value: [PV_REDACTED]\n  - name: PORT\n    value: 8080'],
    ['credentials:\n  client_secret: |\n    fixture-line-one\n    fixture-line-two\nport: 8080', 'credentials:\n  client_secret: [PV_REDACTED]\nport: 8080'],
    ['[auth]\nsecret = """\nfixture-line-one\nfixture-line-two\n"""\nport = 8080', '[auth]\nsecret = """[PV_REDACTED]"""\nport = 8080'],
  ];
  for (const [input, expected] of cases) {
    const result = redact(input);
    assert.equal(result.status, 'ok');
    assert.equal(result.sanitizedText, expected);
  }
  const safe = 'const apiKey = process.env.API_KEY;\npassword = os.getenv("PASSWORD")\nsecret = ENV.fetch("SERVICE_SECRET")\nport = 8080';
  assert.deepEqual(redact(safe), { status: 'ok', findings: [], sanitizedText: safe });
  assert.deepEqual(protect(safe), { status: 'ok', findings: [], sanitizedText: safe });
  const fallback = redact('password = os.getenv("PASSWORD", "fixture-fallback")');
  assert.equal(fallback.status, 'ok');
  assert.doesNotMatch(fallback.sanitizedText, /fixture-fallback/);
  const json = redact('{"api\\u005fkey":"fixture-token","keep":8080}');
  assert.equal(json.status, 'ok');
  assert.deepEqual(JSON.parse(json.sanitizedText), { api_key: '[PV_REDACTED]', keep: 8080 });
  const log = redact('{"message":"Started with password: fixture-value","status":"failed"}');
  assert.equal(log.status, 'ok');
  assert.deepEqual(JSON.parse(log.sanitizedText), { message: '[PV_REDACTED]', status: 'failed' });
  const collection = redact('{"credentials":{"entries":["fixture-value",false]}}', { config: true });
  assert.equal(collection.status, 'ok');
  assert.deepEqual(JSON.parse(collection.sanitizedText), { credentials: { entries: ['[PV_REDACTED]', '[PV_REDACTED]'] } });
});

test('resolves overlapping payment and email matches and keeps one session placeholder', () => {
  const tokens = new Map<string, string>();
  const text = 'Pay to synthetic@sample and pay to synthetic@sample again.';
  const result = protect(text, { tokens });
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.findings.map(finding => finding.type), ['upi', 'upi']);
  const placeholders = result.sanitizedText.match(/\[PV_UPI_[^\]]+\]/g);
  assert.ok(placeholders);
  assert.equal(placeholders.length, 2);
  assert.equal(placeholders[0], placeholders[1]);
  const collision = protect(`${text} Existing: ${placeholders[0]}`, { tokens });
  assert.equal(collision.status, 'ok');
  assert.equal(collision.sanitizedText.split(placeholders[0]).length, 2);
});

test('review can be resolved explicitly and strict mode rejects unresolved review', () => {
  const text = 'IFSC: TEST0123456';
  const unresolved = protect(text);
  assert.equal(unresolved.status, 'review');
  assert.deepEqual(protect(text, { strict: true }).status, 'blocked');
  const [finding] = unresolved.findings;
  const allowed = protect(text, { decisions: { [finding.start]: 'allow' } });
  assert.equal(allowed.status, 'ok');
  assert.equal(allowed.sanitizedText, text);
  const masked = protect(text, { decisions: { [finding.start]: 'mask' } });
  assert.equal(masked.status, 'ok');
  assert.match(masked.sanitizedText, /^IFSC: \[PV_BANK_ROUTING_/);
});

test('checks labeled payment card values and refuses oversized input', () => {
  assert.equal(protect('Card number: 4242 4242 4242 4242').findings[0].type, 'card');
  assert.equal(protect('Card number: 4242 4242 4242 4243').findings.length, 0);
  assert.deepEqual(protect('x'.repeat(maxInput + 1)), { status: 'error', findings: [] });
});
