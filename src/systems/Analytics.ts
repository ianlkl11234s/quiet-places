/// <reference types="vite/client" />

const measurementId = 'G-Z8F8X5C7WC';
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let enabled = false;

export function initAnalytics() {
  if (enabled || !import.meta.env.PROD || location.hostname !== 'quiet-places.itsmigu.com') return;
  enabled = true;
  window.dataLayer ??= [];
  window.gtag = function () { window.dataLayer!.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(script);
}

export function trackEvent(name: 'scene_view' | 'ambient_audio_toggle' | 'music_play', parameters: Record<string, string>) {
  if (enabled) window.gtag?.('event', name, parameters);
}
