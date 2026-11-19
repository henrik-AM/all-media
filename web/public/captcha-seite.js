/*
 * Skript der Seite /captcha (web/server/app.js) — Fahrplan Mail/Captcha C5/C6.
 *
 * Zeigt das Turnstile-Widget und gibt das Token an die Oberfläche weiter,
 * die die Seite geöffnet hat:
 *   - App:     window.ReactNativeWebView.postMessage (CaptchaHost.tsx)
 *   - Website: window.parent.postMessage an die eigene Herkunft (captcha.js)
 *
 * Nachrichten (JSON): { art: 'captcha', token } · { art: 'captcha-fehler', grund }
 *                     { art: 'captcha-aus' } wenn kein Schlüssel eingerichtet ist.
 *
 * Ein Token gilt 300 Sekunden und nur einmal. Deshalb holt jede Anmeldung
 * ein neues — die Seite wird jedes Mal frisch geladen.
 */
(function () {
  'use strict';

  function senden(nachricht) {
    var text = JSON.stringify(nachricht);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(text);
    } else if (window.parent && window.parent !== window) {
      // Nur an die eigene Herkunft — nie an '*'.
      window.parent.postMessage(nachricht, location.origin);
    }
  }

  function hinweis(text) {
    var el = document.getElementById('hinweis');
    if (el) el.textContent = text;
  }

  function skriptLaden(adresse) {
    return new Promise(function (fertig, fehler) {
      var el = document.createElement('script');
      el.src = adresse;
      el.async = true;
      el.onload = fertig;
      el.onerror = function () { fehler(new Error('Turnstile nicht erreichbar')); };
      document.head.appendChild(el);
    });
  }

  async function start() {
    var konfig;
    try {
      konfig = await (await fetch('/api/konfiguration')).json();
    } catch (e) {
      hinweis('Die Sicherheitsprüfung lädt gerade nicht. Bitte später noch einmal.');
      return senden({ art: 'captcha-fehler', grund: 'konfiguration' });
    }
    if (!konfig.turnstileSiteKey) return senden({ art: 'captcha-aus' });

    try {
      await skriptLaden('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    } catch (e) {
      hinweis('Die Sicherheitsprüfung lädt gerade nicht. Bitte prüfe deine Verbindung.');
      return senden({ art: 'captcha-fehler', grund: 'skript' });
    }

    window.turnstile.render('#widget', {
      sitekey: konfig.turnstileSiteKey,
      language: 'de',
      callback: function (token) {
        hinweis('Geprüft.');
        senden({ art: 'captcha', token: token });
      },
      'error-callback': function (code) {
        hinweis('Die Sicherheitsprüfung hat nicht geklappt. Bitte noch einmal versuchen.');
        senden({ art: 'captcha-fehler', grund: String(code || 'widget') });
      },
      'expired-callback': function () {
        senden({ art: 'captcha-fehler', grund: 'abgelaufen' });
      },
    });
  }

  start();
})();
