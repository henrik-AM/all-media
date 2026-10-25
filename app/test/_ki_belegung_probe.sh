#!/usr/bin/env bash
# Isolierte Probe für app/test/_ki_belegung.js — temporäre Zentrale, keine Anmeldung, kein Supabase.
# Aufruf aus app/: bash test/_ki_belegung_probe.sh   (Offline, braucht keine Belegung)
T="${1:-$(cd "$(dirname "$0")" && pwd)}"; S="${2:-$HOME/Library/CloudStorage/OneDrive-Persönlich/Business/AI/Henrik/Claude/Uebergabe/ki-abgleich.sh}"; tmp="$(mktemp -d)"; ok=0; alle=0
pr() { alle=$((alle+1)); if [ "$1" = "$2" ]; then ok=$((ok+1)); echo "   ok    $3"; else echo "   FEHLER $3 (erwartet $2, bekommen $1)"; fi; }
# Umgebung ohne echte Kennungen; Sitzung nur über KI_SITZUNG/KI_SITZUNG_ID.
basis=(env -u CLAUDE_CODE_SESSION_ID -u CODEX_THREAD_ID -u CODEX_SESSION_ID -u SUPABASE_TOKEN KI_ZENTRALE="$tmp" KI_ALLMEDIA="$tmp/x" KI_ABGLEICH="$S")
pb() { "${basis[@]}" "$@" node -e "require('$T/_ki_belegung').pruefeBelegung('testbestand')" >/dev/null 2>&1; echo $?; }
pr "$(pb KI_SITZUNG=11 KI_SITZUNG_ID=A1)" 2 "ohne Belegung: Abbruch 2"
"${basis[@]}" KI_SITZUNG=11 KI_SITZUNG_ID=A1 bash "$S" belegen claude testbestand Probe >/dev/null
pr "$(pb KI_SITZUNG=11 KI_SITZUNG_ID=A1)" 0 "eigene Belegung: läuft"
pr "$(pb KI_SITZUNG=12 KI_SITZUNG_ID=A2)" 2 "andere Claude-Sitzung: Abbruch 2"
pr "$(pb KI_SITZUNG=11 KI_SITZUNG_ID=B9)" 2 "gleiche Prozessnummer, andere Kennung: Abbruch 2"
pr "$(pb KI_SITZUNG=0 KI_SITZUNG_ID=)" 2 "Sitzung nicht erkennbar: Abbruch 2"
# Kindprozess (wie alles.js → spawnSync) erbt die Kennung.
pr "$("${basis[@]}" KI_SITZUNG_ID=A1 KI_SITZUNG=11 node -e "
  const r=require('child_process').spawnSync(process.execPath,['-e',\"require('$T/_ki_belegung').pruefeBelegung()\"],{stdio:'ignore'});process.exit(r.status)" >/dev/null 2>&1; echo $?)" 0 "Kindprozess erbt die Sitzung"
# Codex fremd
"${basis[@]}" KI_SITZUNG=11 KI_SITZUNG_ID=A1 bash "$S" freigeben claude testbestand >/dev/null
"${basis[@]}" KI_SITZUNG=21 KI_SITZUNG_ID=C1 bash "$S" belegen codex testbestand Probe >/dev/null
pr "$(pb KI_SITZUNG=11 KI_SITZUNG_ID=A1)" 2 "Belegung von Codex: Claude bricht ab"
pr "$(pb KI_SITZUNG=21 KI_SITZUNG_ID=C1)" 0 "Codex selbst: läuft"
# Halb geschrieben
rm -rf "$tmp/belegt/testbestand.sperre"; mkdir -p "$tmp/belegt/testbestand.sperre"
pr "$(pb KI_SITZUNG=21 KI_SITZUNG_ID=C1)" 2 "Belegung ohne Angaben: Abbruch 2"
rm -rf "$tmp/belegt/testbestand.sperre"
"${basis[@]}" KI_SITZUNG=11 KI_SITZUNG_ID=A1 bash "$S" belegen claude testbestand Probe >/dev/null
pr "$(pb KI_SITZUNG=11 KI_SITZUNG_ID=A1 KI_ABGLEICH=/gibt/es/nicht.sh)" 2 "Skript fehlt: Abbruch 2"
# Echte Einstiege: _testpasswoerter.js, alles.js, _aufraeumen.js halten vor allem anderen an.
# Echte Einstiege nur mit Attrappe: kein Netz, kein Kindprozess außer ki-abgleich.sh.
M="$tmp/marke"; : > "$M"
ein() { "${basis[@]}" NODE_OPTIONS="--require $T/_ki_belegung_attrappe.js" KI_PROBE_MARKE="$M" "$@" >/dev/null 2>&1; echo $?; }
pr "$(ein KI_SITZUNG=12 KI_SITZUNG_ID=A2 node -e "require('$T/_testpasswoerter')")" 2 "_testpasswoerter.js: fremde Sitzung → 2"
# Eigene Sitzung kommt am Schutz vorbei (danach lädt die Datei, oder ohne .env.local meldet sie das fehlende Passwort).
pr "$("${basis[@]}" NODE_OPTIONS="--require $T/_ki_belegung_attrappe.js" KI_PROBE_MARKE="$M" KI_SITZUNG=11 KI_SITZUNG_ID=A1 node -e "require('$T/_testpasswoerter')" 2>&1 | grep -c 'ABBRUCH  testbestand' )" 0 "_testpasswoerter.js: eigene Sitzung passiert den Schutz"
pr "$(ein KI_SITZUNG=12 KI_SITZUNG_ID=A2 node -e "require('$T/_konto')")" 2 "_konto.js: fremde Sitzung → 2 (vor Anmeldung)"
pr "$(ein KI_SITZUNG=12 KI_SITZUNG_ID=A2 node "$T/alles.js")" 2 "alles.js: fremde Sitzung → 2 vor der Sperre"
# Reihenfolge im Quelltext: Schutz vor Laufsperre und vor dem ersten Aufruf eines Laufs/Resets.
s=$(grep -n "pruefeBelegung" "$T/alles.js" | head -1 | cut -d: -f1)
e=$(grep -nE "^sperreSetzen\(\);|api/reset|spawnSync\(process" "$T/alles.js" | grep -v "^[0-9]*: *//" | head -1 | cut -d: -f1)
pr "$([ -n "$s" ] && [ -n "$e" ] && [ "$s" -lt "$e" ] && echo vorher)" vorher "alles.js: Schutz steht vor Sperre, Reset und Läufen"
pr "$(ein KI_SITZUNG=12 KI_SITZUNG_ID=A2 node "$T/_aufraeumen.js")" 2 "_aufraeumen.js: fremde Sitzung → 2"
pr "$(wc -l < "$M" | tr -d ' ')" 0 "Attrappe: kein Einstieg hat Netz oder Kindprozess erreicht"
# Offline-Läufe bleiben frei: laden den Schutz nicht.
off=0; for f in "$T"/*_einheit.js; do grep -q "_ki_belegung\|_testpasswoerter\|_konto" "$f" && off=$((off+1)); done
pr "$off" 0 "kein *_einheit.js lädt Schutz, Passwörter oder Konto"
rm -rf "$tmp"; echo "Ergebnis: $ok/$alle"; [ "$ok" = "$alle" ]
