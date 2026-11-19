/*
 * Captcha für die Website — Fahrplan Mail/Captcha C5 (Entwurf 19.11.2026).
 *
 * window.Captcha.holen() → Promise<string | undefined>
 *   - undefined: kein Captcha eingerichtet (kein turnstileSiteKey) — die
 *     Anmeldung läuft wie bisher.
 *   - string:    frisches Turnstile-Token für genau EINEN Auth-Aufruf.
 *   - wirft:     abgebrochen oder fehlgeschlagen; die Meldung ist deutsch.
 *
 * Das Widget selbst läuft auf der eigenen Seite /captcha in einem Rahmen —
 * nicht hier. So bleibt die CSP der Hauptseite ohne fremde Skriptquelle
 * (Richtlinie 7.1), und Cloudflare sieht nur, wer sich gerade anmeldet.
 * Gegenstück in der App: app/lib/captcha.ts + app/components/CaptchaHost.tsx.
 */
(function () {
  'use strict';

  var schluessel = null; // null = noch nicht gefragt, '' = aus

  async function eingerichtet() {
    if (schluessel !== null) return schluessel;
    try {
      var konfig = await (await fetch('/api/konfiguration')).json();
      schluessel = konfig.turnstileSiteKey || '';
    } catch (e) {
      // Nicht merken: beim nächsten Versuch noch einmal fragen.
      return '';
    }
    return schluessel;
  }

  function holen() {
    return eingerichtet().then(function (sk) {
      if (!sk) return undefined;
      return new Promise(function (fertig, fehler) {
        var huelle = document.createElement('div');
        huelle.setAttribute('role', 'dialog');
        huelle.setAttribute('aria-label', 'Sicherheitsprüfung');
        huelle.dataset.captcha = '';
        huelle.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);' +
          'display:flex;align-items:center;justify-content:center;padding:16px';
        var karte = document.createElement('div');
        karte.style.cssText = 'background:#fff;border-radius:16px;width:100%;max-width:360px;' +
          'padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px';
        var rahmen = document.createElement('iframe');
        rahmen.src = '/captcha';
        rahmen.title = 'Sicherheitsprüfung';
        rahmen.style.cssText = 'border:0;width:100%;height:190px';
        var abbrechen = document.createElement('button');
        abbrechen.type = 'button';
        abbrechen.textContent = 'Abbrechen';
        abbrechen.style.cssText = 'border:0;background:none;color:#555;font-size:15px;padding:10px;cursor:pointer';
        karte.appendChild(rahmen);
        karte.appendChild(abbrechen);
        huelle.appendChild(karte);

        function schliessen() {
          window.removeEventListener('message', empfangen);
          huelle.remove();
        }
        function empfangen(e) {
          // Nur Nachrichten der eigenen /captcha-Seite aus genau diesem Rahmen.
          if (e.origin !== location.origin || e.source !== rahmen.contentWindow) return;
          var n = e.data || {};
          if (n.art === 'captcha' && typeof n.token === 'string' && n.token) {
            schliessen();
            fertig(n.token);
          } else if (n.art === 'captcha-aus') {
            schliessen();
            schluessel = '';
            fertig(undefined);
          } else if (n.art === 'captcha-fehler' && n.grund !== 'abgelaufen') {
            // Rahmen offen lassen: das Widget bietet selbst einen neuen Versuch an.
          }
        }
        abbrechen.addEventListener('click', function () {
          schliessen();
          fehler(new Error('Sicherheitsprüfung abgebrochen.'));
        });
        window.addEventListener('message', empfangen);
        document.body.appendChild(huelle);
      });
    });
  }

  window.Captcha = { holen: holen };
})();
