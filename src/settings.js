import { escape, icon } from './ui.js';
import { THEMES, chosenTheme, autoNight } from './theme.js';
import { syncState } from './store.js';
import { scenery } from './scenery.js';

const ago = t => {
  if (!t) return 'never';
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} hr ago` : new Date(t).toLocaleDateString();
};

function syncSection() {
  const s = syncState();
  let status;
  if (s.reason === 'checking') status = 'Checking…';
  else if (!s.available) {
    status = {
      'no-storage': 'Sync isn’t set up on the site yet. Add Upstash Redis to the Vercel project (see the README). Until then, everything you add stays on this device.',
      'no-passcode': 'Storage is connected, but the site has no passcode yet. Add STEVIE_PASSCODE in the Vercel project settings, then redeploy.',
      offline: 'You’re offline. Changes are saved on this device and will sync later.',
      'no-api': 'This copy of the site can’t reach its sync service. Everything you add stays on this device.',
    }[s.reason] || 'Sync is unavailable.';
  } else if (!s.hasPasscode) status = 'Enter your passcode to sync your library across your phone and laptop.';
  else if (s.error) status = s.error;
  else status = `Synced ${ago(s.lastSynced)}.${s.pending ? ` ${s.pending} change${s.pending === 1 ? '' : 's'} waiting.` : ''}`;
  return `<section class="settings-block" id="sync">
    <h2>Sync</h2>
    <p class="status ${s.connected && !s.error ? 'ok' : ''}">${s.connected && !s.error ? icon('check') : ''}${escape(status)}</p>
    ${s.available ? `<form class="pass-form" data-form="passcode">
      <label class="field"><span class="field-label">Passcode</span><input type="password" name="passcode" autocomplete="current-password" placeholder="${s.hasPasscode ? '••••••••' : 'The STEVIE_PASSCODE you set on Vercel'}" /></label>
      <div class="row"><button class="btn btn-primary btn-small" type="submit">${s.hasPasscode ? 'Update passcode' : 'Connect'}</button>
      ${s.hasPasscode ? `<button class="btn btn-ghost btn-small" type="button" data-action="sync-now">${icon('sync')}Sync now</button><button class="btn btn-ghost btn-small" type="button" data-action="forget-pass">Sign out on this device</button>` : ''}</div>
    </form>` : ''}
  </section>`;
}

export function settingsView() {
  const current = chosenTheme();
  const origin = location.origin;
  return `<section class="page-head"><h1>Settings</h1></section>
  <section class="settings-block">
    <h2>Look</h2>
    <div class="theme-grid" role="radiogroup" aria-label="Theme">
      ${THEMES.map(t => `<button class="theme-card" role="radio" aria-checked="${t.id === current}" data-action="theme" data-value="${t.id}">
        <span class="theme-swatch" data-theme="${t.id}">${t.id === 'plain' ? '<span class="swatch-plain"><i></i><i></i><i></i></span>' : scenery(t.id === 'night' ? 'night' : 'day')}</span>
        <span class="theme-name">${escape(t.name)}${t.id === current ? icon('check') : ''}</span>
        <span class="theme-blurb">${escape(t.blurb)}</span>
      </button>`).join('')}
    </div>
    <label class="toggle"><input type="checkbox" data-action="auto-night" ${autoNight() ? 'checked' : ''}/><span>Switch Meadow to Firefly night when my phone is in dark mode</span></label>
  </section>
  ${syncSection()}
  <section class="settings-block">
    <h2>On your phone</h2>
    <details class="howto"><summary>Put it on your home screen</summary>
      <p><strong>iPhone:</strong> open the site in Safari, tap the Share button, then <em>Add to Home Screen</em>. It opens full-screen like an app.</p>
      <p><strong>Android:</strong> in Chrome, tap the menu, then <em>Add to Home screen</em> or <em>Install app</em>.</p>
    </details>
    <details class="howto"><summary>Share links straight from TikTok or Instagram</summary>
      <p><strong>Android:</strong> once it’s installed on your home screen, Stevies World shows up in the Share menu. Share a post to it and the import starts automatically.</p>
      <p><strong>iPhone:</strong> make a one-time Shortcut so Stevies World appears in the Share sheet:</p>
      <ol>
        <li>Open the Shortcuts app and tap <em>+</em>. Name it “Save to Stevies World”.</li>
        <li>Tap the <em>i</em> (details) button and turn on <em>Show in Share Sheet</em>. Set it to receive <em>URLs</em> and <em>Text</em>.</li>
        <li>Add the action <em>URL</em> and set it to <code>${escape(origin)}/?add=</code> followed by the <em>Shortcut Input</em> variable.</li>
        <li>Add the action <em>Open URLs</em>.</li>
      </ol>
      <p>Now tap Share on any TikTok, Instagram or website, choose <em>Save to Stevies World</em>, and the import opens ready to save.</p>
      <p class="hint">Or just copy the link and tap <em>Paste a link</em> on the home screen.</p>
    </details>
  </section>
  <section class="settings-block">
    <h2>Backups</h2>
    <p>Download everything you’ve added as a file, or load one back in. Loading merges with what’s here.</p>
    <div class="row"><button class="btn btn-ghost btn-small" data-action="export">Download backup</button>
    <label class="btn btn-ghost btn-small">Load a backup<input type="file" accept="application/json,.json" data-action="import-file" hidden /></label></div>
  </section>
  <p class="fine about">Healthy-living notes are general information for adults, not personal medical advice.</p>`;
}
