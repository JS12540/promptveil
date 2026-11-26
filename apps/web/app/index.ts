import { mountComposer } from '../../../packages/ui/composer.ts';

mountComposer({ redact: true });
const update = document.getElementById('update') as HTMLButtonElement;
const status = document.getElementById('offline')!;
const install = document.getElementById('install') as HTMLButtonElement;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  install.hidden = false;
  install.onclick = async () => {
    await (event as Event & { prompt(): Promise<void> }).prompt();
    install.hidden = true;
  };
});
if ('serviceWorker' in navigator) {
  status.hidden = false;
  status.textContent = 'Preparing offline use…';
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then(async registration => {
    function offerUpdate() {
      if (registration.waiting && navigator.serviceWorker.controller) update.hidden = false;
    }
    registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', offerUpdate));
    offerUpdate();
    update.onclick = () => {
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
      registration.waiting?.postMessage('apply-update');
    };
    await navigator.serviceWorker.ready;
    status.textContent = 'Ready to scan offline.';
  }).catch(() => {
    status.textContent = 'Offline setup unavailable.';
  });
}
