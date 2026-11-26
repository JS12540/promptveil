import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chatOrigins } from '../apps/extension/providers.ts';
import { renderInstallGuide } from './markdown.mjs';

const output = 'dist';
const web = join(output, 'web');
const extension = join(output, 'extension');
const cli = join(output, 'cli');
const webOnly = process.argv.includes('--web-only');
const { VERCEL_GIT_PROVIDER, VERCEL_GIT_REPO_OWNER, VERCEL_GIT_REPO_SLUG } = process.env;
const vercelRepository = VERCEL_GIT_PROVIDER === 'github' && VERCEL_GIT_REPO_OWNER && VERCEL_GIT_REPO_SLUG
  ? `${VERCEL_GIT_REPO_OWNER}/${VERCEL_GIT_REPO_SLUG}`
  : '';
const repository = process.env.GITHUB_REPOSITORY || vercelRepository;
if (repository && !/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid GITHUB_REPOSITORY.');
const sourceLink = repository ? `https://github.com/${repository}` : './docs/';
const releaseLink = repository ? `${sourceLink}/releases/latest` : './docs/#laptop';
const html = (title, head, content) => `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>${head}</head><body>${content}</body></html>\n`;
const localCsp = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; object-src \'none\'; connect-src \'none\'; base-uri \'none\'; form-action \'none\'">';

async function put(file, content) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function compile(destination, files) {
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const stripped = stripTypeScriptTypes(source, { mode: 'strip' })
      .replace(/(from |new URL\(|import\()(['"])(\.[^'"\n]+)\.ts\2/g, '$1$2$3.js$2');
    const target = join(destination, file.replace(/\.ts$/, '.js'));
    await put(target, stripped);
  }
}

// Static content scripts run as classic scripts. Bundle this local, acyclic entry
// with its named imports so the clipboard handler can run synchronously.
async function buildPasteScript() {
  const order = ['packages/core/index.ts', 'apps/extension/providers.ts', 'apps/extension/send.ts', 'apps/extension/scan-pause.ts', 'apps/extension/guard-diagnostics.ts', 'apps/extension/launcher.ts', 'apps/extension/paste.ts'];
  const parts = [];
  for (const file of order) {
    const source = stripTypeScriptTypes(await readFile(file, 'utf8'), { mode: 'strip' });
    const classic = source
      .replace(/^import \{[^}\r\n]+\} from '[^'\r\n]+';\r?$/gm, '')
      .replace(/^export (?=(?:const|function) )/gm, '');
    if (/^\s*(?:import|export)\s/m.test(classic)) throw new Error(`Unsupported module declaration in ${file}`);
    parts.push(classic);
  }
  await put(join(extension, 'apps/extension/paste.js'), '(() => {\n' + parts.join('\n') + '\n})();\n');
}

async function filesIn(root, path = '') {
  const result = [];
  for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
    const name = [path, entry.name].filter(Boolean).join('/');
    if (entry.isDirectory()) result.push(...await filesIn(root, name));
    else result.push(name);
  }
  return result.sort();
}

await rm(webOnly ? web : output, { recursive: true, force: true });
await mkdir(join(web, 'assets'), { recursive: true });
const composer = await readFile('packages/ui/composer.html', 'utf8');
const landing = (await readFile('apps/web/index.html', 'utf8'))
  .replaceAll('@@REPO@@', sourceLink).replaceAll('@@RELEASE@@', releaseLink);
await put(join(web, 'index.html'), landing);
await put(join(web, 'app/index.html'), html('PromptVeil · Private composer',
  localCsp + '<link rel="stylesheet" href="../assets/style.css"><link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./icon-192.png">',
  composer.replace('Scan locally, then copy or transfer the protected text.', 'Mask detected values locally, then copy the protected text.')
    .replace('</header>', '<button id="install" hidden>Install PromptVeil</button><button id="update" hidden>Apply update and clear session</button></header>')
    .replace(/<label class="check">.*?<\/label>/, '<input id="strict" type="checkbox" hidden><label class="check"><input id="config-values" type="checkbox"> Mask all config values, including unknown fields</label>')
  + '<script type="module" src="../apps/web/app/index.js"></script>'));
await cp('packages/ui/style.css', join(web, 'assets/style.css'));
await cp('apps/web/landing.css', join(web, 'assets/landing.css'));
await put(join(web, 'app/manifest.webmanifest'), JSON.stringify({
  id: './', start_url: './', scope: './', name: 'PromptVeil', short_name: 'PromptVeil',
  display: 'standalone', background_color: '#0a1423', theme_color: '#0a1423',
  icons: [192, 512].map(size => ({ src: `icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png' })),
}, null, 2));

const modules = ['packages/core/index.ts', 'packages/ui/composer.ts', 'packages/ui/worker.ts'];
await compile(web, [...modules, 'apps/web/app/index.ts']);

const docs = await readFile('docs/install.md', 'utf8');
const installText = renderInstallGuide(docs, repository ? sourceLink : '');
await put(join(web, 'docs/index.html'), html('PromptVeil · Installation', localCsp
  + '<link rel="stylesheet" href="../assets/style.css"><link rel="stylesheet" href="./docs.css">',
  `<main class="composer"><a href="../">PromptVeil home</a><h1>Installation guide</h1><p><a href="${repository ? sourceLink + '/blob/main/docs/README.md' : '../app/'}">${repository ? 'All project documentation' : 'Open the private composer'}</a></p>${installText}</main>`));
await put(join(web, 'docs/docs.css'), 'pre { overflow: auto; padding: 1rem; border-radius: .5rem; background: #132238; } li { margin: .4rem 0; }');

for (const size of [192, 512]) {
  await cp(`apps/web/icons/icon-${size}.png`, join(web, `app/icon-${size}.png`));
}
const offlineFiles = (await filesIn(web)).filter(name => !name.startsWith('docs/') && name !== 'index.html' && name !== 'assets/landing.css');
const cacheHash = createHash('sha256');
for (const file of offlineFiles) cacheHash.update(await readFile(join(web, file)));
const sw = (await readFile('apps/web/app/sw.js', 'utf8'))
  .replace('/* CACHE_NAME */ null', JSON.stringify(`promptveil-${cacheHash.digest('hex').slice(0, 16)}`))
  .replace('/* PRECACHE */ null', JSON.stringify(['./', ...offlineFiles.map(file => `../${file}`)]));
await put(join(web, 'app/sw.js'), sw);

if (webOnly) {
  console.log('Built the static website in dist/web/.');
} else {
  await buildRelease();
}

async function buildRelease() {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const python = process.platform === 'win32' ? 'python' : 'python3';
  await put(join(extension, 'index.html'), html('PromptVeil · Private composer',
    '<link rel="stylesheet" href="./assets/style.css"><link rel="stylesheet" href="./assets/popup.css">',
    composer + '<footer class="popup-footer"><button class="secondary" type="button" id="open-guard-diagnostics">Open guard diagnostics in a new tab</button><div id="diagnostics-open-status" role="status"></div></footer><script type="module" src="./apps/extension/index.js"></script>'));
  const panel = composer.replace('Scan locally, then copy or transfer the protected text.', 'Write here. Protect and insert places the checked draft in your chat.');
  await put(join(extension, 'panel.html'), html('PromptVeil · Private chat composer',
    '<link rel="stylesheet" href="./assets/style.css">',
    panel + '<script type="module" src="./apps/extension/index.js"></script>'));
  await put(join(extension, 'assets/popup.css'), 'body { width: 420px; max-width: 100vw; } .popup-footer { padding: 0 1.25rem 1.25rem; }');
  await cp('apps/extension/diagnostics.html', join(extension, 'diagnostics.html'));
  await cp('apps/extension/diagnostics.css', join(extension, 'assets/diagnostics.css'));
  await cp('packages/ui/style.css', join(extension, 'assets/style.css'));
  const manifest = JSON.parse(await readFile('apps/extension/manifest.json', 'utf8'));
  manifest.host_permissions = chatOrigins.map(origin => origin + '/*');
  for (const script of manifest.content_scripts) script.matches = manifest.host_permissions;
  await put(join(extension, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await compile(extension, [...modules, 'apps/extension/index.ts', 'apps/extension/insert.ts',
    'apps/extension/providers.ts', 'apps/extension/background.ts', 'apps/extension/scan-pause.ts', 'apps/extension/guard-diagnostics.ts', 'apps/extension/diagnostics-page.ts']);
  await buildPasteScript();
  execFileSync(python, ['scripts/artifacts.py', 'icons', join(extension, 'assets'), '16', '32', '48', '128'], { stdio: 'inherit' });

  const packageRoot = join(cli, 'package');
  await compile(packageRoot, ['apps/cli/index.ts', 'apps/cli/agents.ts', 'apps/gateway/index.ts',
    'adapters/claude-code/index.ts', 'adapters/codex/index.ts', 'adapters/cursor/index.ts', 'adapters/gemini/index.ts', 'packages/core/index.ts']);
  await put(join(packageRoot, 'package.json'), JSON.stringify({
    name: 'promptveil', version, type: 'module', license: 'Apache-2.0',
    description: 'Local context-aware prompt protection',
    engines: { node: '>=22.18.0' }, bin: { promptveil: 'apps/cli/index.js' },
  }, null, 2));
  for (const name of ['README.md', 'LICENSE', 'NOTICE']) {
    await cp(name, join(packageRoot, name)).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
  execFileSync(python, ['scripts/artifacts.py', 'pack', output, version], { stdio: 'inherit' });
  const artifacts = ['extension.zip', 'site.zip', `cli/promptveil-${version}.tgz`];
  const sums = await Promise.all(artifacts.map(async name =>
    `${createHash('sha256').update(await readFile(join(output, name))).digest('hex')}  ${name.split('/').at(-1)}`));
  await put(join(output, 'SHA256SUMS'), sums.join('\n') + '\n');
  console.log('Built web, extension, CLI package, and checksums in dist/.');
}
