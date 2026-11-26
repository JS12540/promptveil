import assert from 'node:assert/strict';
import { chatOrigins } from '../apps/extension/providers.ts';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const files = new Map([
  ['extension.zip', 'dist/extension.zip'],
  ['site.zip', 'dist/site.zip'],
  [`promptveil-${version}.tgz`, `dist/cli/promptveil-${version}.tgz`],
]);
const hashes = (await readFile('dist/SHA256SUMS', 'utf8')).trimEnd().split('\n');
assert.equal(hashes.length, files.size, 'Expected a checksum for every distribution asset.');
for (const entry of hashes) {
  const [expected, name] = entry.split('  ');
  assert.ok(files.has(name), `Unexpected or duplicate checksum entry: ${name}`);
  const buffer = await readFile(files.get(name));
  assert.equal(createHash('sha256').update(buffer).digest('hex'), expected, `Checksum mismatch: ${name}`);
  if (name !== 'site.zip') assert.ok(buffer.length <= 3_000_000, `Size budget exceeded: ${name}`);
  files.delete(name);
  console.log(`${name}: ${buffer.length} bytes, checksum verified`);
}

const manifest = JSON.parse(await readFile('dist/extension/manifest.json', 'utf8'));
assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'scripting', 'sidePanel']);
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, version);
assert.ok(chatOrigins.every(origin => /^https:\/\/[a-z0-9.-]+$/.test(origin)));
assert.deepEqual(manifest.host_permissions, [...new Set(chatOrigins)].map(origin => origin + '/*'));
assert.equal(manifest.optional_host_permissions, undefined);
assert.equal(manifest.optional_permissions, undefined);
assert.equal(manifest.externally_connectable, undefined);
assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'none'; connect-src 'none'");
for (const script of manifest.content_scripts) assert.deepEqual(script.matches, manifest.host_permissions);
assert.equal(manifest.content_scripts.length, 1);
const paste = manifest.content_scripts.find(script => script.js.includes('apps/extension/paste.js'));
assert.equal(paste?.run_at, 'document_start');
assert.equal(paste?.world, 'ISOLATED');
assert.equal(manifest.web_accessible_resources, undefined);
for (const file of [manifest.action.default_popup, manifest.side_panel.default_path, manifest.background.service_worker,
  'diagnostics.html', 'assets/diagnostics.css', 'apps/extension/diagnostics-page.js', ...manifest.content_scripts.flatMap(script => script.js)]) {
  assert.ok((await stat(`dist/extension/${file}`)).isFile());
}

const web = JSON.parse(await readFile('dist/web/app/manifest.webmanifest', 'utf8'));
assert.equal(web.scope, './');
assert.equal(web.start_url, './');
for (const { src } of web.icons) assert.ok((await stat(`dist/web/app/${src}`)).isFile());
assert.match(await readFile('dist/web/app/sw.js', 'utf8'), /promptveil-[a-f0-9]{16}/);
const webApp = await readFile('dist/web/app/index.html', 'utf8');
assert.match(webApp, /<meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'">/);
assert.doesNotMatch(webApp, /<script(?![^>]*\ssrc="\.\.\/)[^>]*>/i);
for (const name of ['LICENSE', 'NOTICE', 'README.md']) assert.ok((await stat(`dist/cli/package/${name}`)).isFile());
