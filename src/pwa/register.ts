// The installable app in the page: the service worker (the build makes
// sw.js, scripts/pwa.mjs), and what the browser says about installing.

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { standalone?: boolean }) : null;

export const pwa = {
  // Chrome's install offer, held until the player taps INSTALL.
  offer: null as InstallEvent | null,
  installed: false,
  // Already running as an installed app (home screen, full screen).
  standalone:
    typeof window !== 'undefined' &&
    (!!nav?.standalone || !!window.matchMedia?.('(display-mode: standalone)').matches || !!window.matchMedia?.('(display-mode: fullscreen)').matches),
  // iPhone or iPad Safari, where adding to the home screen is by hand.
  ios: !!nav && (/iPhone|iPad|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)),
};

export function registerPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pwa.offer = e as InstallEvent;
  });
  window.addEventListener('appinstalled', () => {
    pwa.offer = null;
    pwa.installed = true;
  });
  // Only the static build has a worker; under the dev server it would keep
  // stale modules.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  // Registering again does not look for a new worker, so ask on every
  // launch (and when the app comes back after an hour away): a new deploy's
  // files are then kept for offline play straight away.
  let checked = 0;
  const check = (reg: ServiceWorkerRegistration) => {
    checked = Date.now();
    reg.update().catch(() => { /* offline: next time */ });
  };
  const go = () =>
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      check(reg);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - checked > 3600e3) check(reg);
      });
    }, () => { /* plays fine online */ });
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go);
}

// Show Chrome's own install dialog (a tap on INSTALL).
export async function promptInstall(): Promise<boolean> {
  const e = pwa.offer;
  if (!e) return false;
  pwa.offer = null;
  try {
    await e.prompt();
    const r = await e.userChoice;
    if (r.outcome === 'accepted') pwa.installed = true;
    return r.outcome === 'accepted';
  } catch {
    return false;
  }
}
