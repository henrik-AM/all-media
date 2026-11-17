# Gemeinsamer Abschluss Paket 6 und 7

## Abnahmematrix des aktuellen gemeinsamen Auftrags

Die späteren Abschnitte dokumentieren den Verlauf einschließlich verworfener
Prüfstände. Diese Matrix beschreibt den maßgeblichen aktuellen Stand.

| Anforderung | Geprüfter Beleg | Status |
|---|---|---|
| Genau eine tatsächliche Claude-Testschleife, danach Codex-Korrektur | `pruefbelege/paket67-abschluss/claude-pruefung.md`, `claude-nachholpruefung.md`; neue Reproduktion scheitert, korrigierte Stumm-/Listenfälle und Bereitschaft zusammen 23/23 | Erfüllt; Quote war verfügbar |
| Alte sieben Gesamtlauffehler einzeln auswerten | `berichte/Paket-7-Claude-Fortsetzung-16-11-2026.md`; Einzelläufe einschließlich Prozesscodes, Startkonfiguration und Prüfzielkorrektur dokumentiert | Erfüllt; abschließender gemeinsamer Lauf noch offen |
| Tatsächliche Original-Provider mit echten Testkonten | `native-ergebnis.json`:18/18; Kontakt/Gruppe, Dreifachtipp, Fehler, Fernänderung und A/B/A | Erfüllt; Authentifizierung aus Prüfrahmen, keine Behauptung physischer Geräte |
| Neue Verschlüsselung, gemeinsame Nummern und native Plattformwirkung | `native-paar-ergebnis.json`:6/6; `native-neustart.json`:2 unveränderte Schlüssel; `paket67-chat-final`:native18/18,Plattform14/14,Exit0 | Erfüllt; ursprüngliche Bildschirme, separate Testkontexte wie unten beschrieben |
| Paket6-Nacharbeiten einschließlich Schema127 | `schema127-live-probe.json`:23/23, verworfen; Einspielungsbeleg; `paket67-p6`:Live40/40; aktuelle Browser38/38 und Kontakt-Live10/10; Offline10/10Gruppen | Erfüllt; Clients noch nicht veröffentlicht |
| Vollständiger integrierter Nachweis | Aktueller Originalstatus54a2008c,103Suiten,Quellstande5b2b08,Quellwächter und Bereinigungsjournal | **Läuft; Endcode, alle Nenner, Quellgleichheit und Rest0 noch prüfen** |
| Aktuelle Projektübersichten, Testdaten und Prozesse sauber abschließen | Native-/Plattform-/Paket6-Fixtures jeweilsRest0; Vaultübersichten aktualisiert; Gesamtlauf/Prüfserver noch aktiv | **Abschluss nach Gesamtlauf offen** |
| Geprüfte Inhalte nachmain und Push übernehmen, Render tatsächlich prüfen | Henriks ausdrücklicher gemeinsamer Auftrag; `origin/main` und Hauptordner weiterhin627fa86, sauber, Vorfahr des Integrationszweigs | **Veröffentlichung und Live-Nachweis offen; Autorisierung vorhanden** |

Drei akzeptierte mittlere Expo-Auditbefunde bleiben unverändert. Pakete8/9
gehören nicht zu diesem Auftrag. Historische und fremde Arbeitsstände bleiben erhalten.


Henrik erweitert den Auftrag ausdrücklich: Paket7 abschließen, eine echte
Claude-Prüfschleife (bei verbrauchter Quote überspringen), Codex korrigiert;
anschließend alle bis zu diesem Stand geprüften veröffentlichbaren Inhalte
einschließlich Paket6 nachmain,PushundDeploy. Keine weitere Freigabe nötig.

Eigenständiger Integrationszweig codex/paket67-abschluss-2026-11-16,
BasisPaket7 1eef00b plus Paket6-Review53b1472/Produkt ee57c82.
Paket6 war bereits unabhängig Opus-geprüft, aber Schema127/Live/native
offen. Diese Schritte bleiben bis zum Nachweis offen; noch kein Push.

## Tatsächliche Claude-Schleife

ErsterCLI-Aufruf war im vonCodex gewählten dontAsk-Modus: Bashprüfungen
blockiert, keine Testzahlen. Er lieferte einen materiellen Codebefund und
einen Hinweis auf alte Listenantworten. Technischer Nachholauf derselben
Schleife im beauftragten ausführbaren Modus, keine zweite Reviewrunde:
Claude-Pro-Quota verfügbar,7/7+26/26,TypeScriptExit0; eigeneReproduktion
0/1,Exit1 für Fernänderung während Lesefehler. Produktquellen vonClaude
nicht verändert. Berichte inpruefbelege/paket67-abschluss.

Codex reproduziert mit zwei Zusatzfällen:Alt7/9,Korrektur9/9.
DatenContext meldet erfolgreiche Listenabrufe und deren Beginn; auch
ein unveränderter erfolgreich gelesener Stand bestätigt die Frische.
Ein bestätigter Wunsch weicht damit einem späteren Serverwert, auch
wenn die eigene Auswahl vor dem ersten erfolgreichen Lesen schon
vom Zweitgerät geändert wurde. Gemeinsame Auftragsnummern verhindern
überschreibende alte explizite bzw.Klingelantworten. Drei Gegenproben
zu Reihenfolge/Frische zusätzlich grün; Paket7-Stumm+Regression21/21.

Paket6/7 automatisch zusammengeführt; einziger Textkonflikt in der
Schemareihenfolge erhält beide Abschnitte100und127. TypeScriptExit0,
Paket6-Offlineskript10/10Gruppen inklusiveOpus14/14. Neue Gesamtzahl
102Suiten durch Aufnehmen derPaket6-Opus-Gegenproben.

Offen: verworfeneLiveprobe127 mit echtenRLS/Schema95,Einspielung,native
und plattformübergreifende gemeinsameAbnahme,finalerGesamtlauf,
Bereinigung,danach autorisiertermain/Push/Rendernachweis.

## Schema127 live geprüft und angewendet

Verworfene Liveprobe auf echten RLS/Schema95:23/23,neue Spalte und
Constraint nachRollback wiederimOriginalstand,eigeneFixtureRest0.
Erste Probenfassung erwartete für Schema95 einen CHECK-Code; tatsächlich
korrekt42501 (Rechtesperre). Erwartung korrigiert, kein Produktfehler.
Nach grüner Probe Schema127 einmalig angewendet. Nachprüfung: neueSpalte,
validierterConstraint,internerZeittrigger vorhanden,anon/authenticated
Direktaufrufgesperrt,Schema95-Trigger erhalten.344Bestandsnachrichten
und2Format1-Nachrichten vorher/nachher unverändert. SQL-Prüfsumme und
Metadaten inpruefbelege/paket67-abschluss/schema127-live-einspielung.json.
Noch keine Veröffentlichung; neueClients undnativeAbnahme folgen.

## Native Originalkontexte und Sicherheitsanzeige

Original DatenProvider+ProfilProvider im eigenen iOS-Simulator mit zwei echten
Testkontensitzungen:18/18; Kontakt/Gruppe, Dreifachtipp, Schreibfehler,
Lesefehler mit später abweichendem Fernwert und A/B/A geprüft. Authentifizierung
und gezielte Transportfehler kommen aus einem Prüfrahmen; keine Abnahme zweier
physischer Geräte oder des vollständigen Anmeldeflusses.
Paar-Sicherheitsnummern gegen beide Live-Gerätelisten:6/6 inklusive sichtbarem
Schließen. Zwei Prozessneustarts erhalten dieselben zwei SecureStore-Schlüssel.
Die vielen vorhandenen Test-Geräteschlüssel ließen den Infotext vorher über das
Blatt hinauswachsen. Nur das Verschlüsselungs-Infoblatt ist jetzt auf74% Höhe
begrenzt und blätterbar; beide Ansichten visuell geprüft, Zurück bedienbar.
Alle eigenen Chats/Mitgliedschaften/Nachrichten/Schlüssel dieses Laufs entfernt,
Rest0. Belege:native-ergebnis,native-paar-ergebnis,native-neustart,native-fixtures.

## Geräteuhr: tatsächliche native Gegenprobe und Korrektur

Erster gemeinsamer Format2-Lauf:Website14/14 und eigeneFixturesRest0;
native Kernprüfungen17grün, aber zusätzlicher Geräteuhr-Meldungstest scheitert,
Exit1. Die Datenbank lehnt eine um24h verstellte Geräteuhr korrekt ab und der
Entwurf bleibt erhalten; sichtbar war eine SQL-Constraint-Meldung. Der erste
Treiber druckte seinen17er-Zwischenzähler vor dieser Zusatzassertion; deshalb
war dies ausdrücklich KEINE bestandene native Gesamtabnahme.
Codex reproduziert die Fehlermeldung offline in App und Server:Alt14/16.
Nur23514 zum Constraint messages_krypto_stimmig bei selbst erzeugtemFormat2
wird jetzt verständlich zur Geräteuhr-Meldung. Fremde Constraints/Rechtesperren
bleiben erkennbar. Korrektur16/16,TypeScriptExit0. Die Weiterleitungsroute
meldet dieselbe Absage. Native Wiederholung mit endgültiger18er-Zählung läuft.
Ältere Paket6-Livetreiber erwarten für neue Rundreisen jetztFormat2; gezielt
angelegte historischeFormat1-Gegenproben bleibenFormat1.

## Gemeinsame native/Website-Abnahme grün

Wiederholung auf korrigiertem Produktstand6ca1138:18/18 native Prüfungen,
Exit0;14/14 Website-/Plattformprüfungen,Exit0;eigeneFixtureRest0. Tatsächliche
Original-ChatDetailScreens mit zwei getrennten nativen Geräteschlüsseln,
Originaldaten-/Krypto-/Schreibmodule und zwei tatsächlich angemeldete Browser.
Kontextrahmen im Chatprüfstand ersetzt Listen-/Profilversorgung; deren echte
Provider wurden separat oben geprüft. App↔App,App↔Website,Gruppe,65s gedrosselte
Standabfragen,3s verspätetesKuvert,Hintergrund-Rückkehr,Format2-Kontextkopie
mit abweichenderID sowie24h falscheGeräteuhr inklusiveEntwurf undverständlicher
Meldung bestanden. Vor der nativen Schlüsselregistrierung gesendete Browser-
Nachrichten bleiben für diese neuen Geräte erwartungsgemäß unlesbar.
FinaleScreenshots selbst angesehen; keine Zugangswerttreffer in den neuen
Textbelegen. NativeApp/Metro3301 beendet. Belege:pruefbelege/paket67-chat-final.
Paket6-Browserkomponenten mit abgefangener Datenversorgung28/28;keine externen
Anfragen. Abschließende Offlineprüfung10/10Gruppen inklusiveOpus16/16,
Paket7zusammen21/21,TypeScriptExit0. Vollständige Live-Paket6-Cacheprobe läuft.

## Paket6-Livetreiber auf Format2 und Paarvergleich nachgezogen

Erster älterer Livetreiber31/38,Exit1,Rest0:Zwei Website→App-Logik-Fälle
lasen die inzwischen kryptografisch gebundenen Zeitspalten gar nicht; drei
Sicherheitsnummer-Fälle verglichen weiterhin nur Gegenüber-Geräte statt beider
Konten;zwei Cache-Erwartungen verlangten das Entfernen der bewusst permanenten
Format1-Warnung. Diese sieben Fehler widersprechen der getrennten erfolgreichen
nativen Plattformabnahme nicht:der alte Treiber lieferte unvollständige Eingaben
bzw.alte Erwartungen. Jetzt zentrale NACHRICHT_SPALTEN,gemeinsamePaarfunktion,
Format2für den tatsächlichen Vertrauenscachewechsel und zwei zusätzliche
Format1-Warnungsgegenproben. Produktcode dafür unverändert. Vollständige
Wiederholung mit40Prüfungen läuft; alterLauf unterpaket67-p6-alt erhalten.

## Paket6-Liveabnahme vollständig grün; gemeinsamer Vollnachweis gestartet

Korrigierter Livetreiber40/40,Exit0,FixtureRest0. Echte Browseranmeldungen,
Supabase-RLS und originale App-Logik mit simuliertem Schlüsselbund:Format2-
Rundreisen,gemeinsameGerätenummern,Kontowechsel/Neustart,Kuvert-Klingel,
Validierungsgrenzen500/501,Format1-Warnungen undtatsächlicher60sVertrauenscache
nachNeuregistrierung/Entfernung bestanden. VollständigeBelege unterpaket67-p6;
die vorigen31/38undaltenErwartungen bleiben unterpaket67-p6-alt erhalten.
VierTestmitteilungen aus den exklusivenVorlaufprüfungen mitOriginal-BETEILIGT-
Filter bereinigt,Rest0,danachOriginaljournal neu begonnen.
GemeinsamerGesamtlauf639f542b-5f39-44b3-ae0d-eb9704957820,102Suiten,
Quellstandbb9f243,läuft unverändert mitOriginal-QuellwächterundBereinigung.
NochkeinVeröffentlichungsnachweis;main/Push/Render folgen erst nachAuswertung.

## Pause nach Systemhinweis zur aktiven Sitzungszeit

Systemhinweis nach sechs Stunden verlangt Sicherung und Pause vor dem nächsten
riskanten Schritt. Deshalb keinmain/Push/Deploy in diesem Abschnitt. Der bereits
gestartete, unabhängig laufendeGesamttest bleibt aktiv (PID29530,Elternsteuerung
29215,caffeinate29532,Prüfserver26177). Keine Migration läuft. Nicht nochmals
starten,keineQuellenändern,keinenTestbestandparallelverwenden. Rohstatus:
app/test/.gesamtlauf-belege/639f542b-5f39-44b3-ae0d-eb9704957820/status.json.
Endcode:pruefbelege/paket67-abschluss/gesamtlauf-exit.txt;Originaljournal räumt
Testmitteilungen amLaufende auf. Belegungen bleiben bis dahin bewusst bestehen.
NachPause zuerst Endstatus,alle102Nenner,Quellgleichheit undRest0 prüfen;
dann vorhandeneHenrik-Autorisierung fürmain/Push/Render weiterverwenden.
Die Pause ist keinAbschluss desbeauftragtenZiels. Eigener letzterQuellstand
bb9f243,seitStart ausschließlichBelege/Dokumentationcommits.

## Aktueller Vollnachweis: Kontaktinfo-Wiederöffnen noch rot

639f542b bei15/102Suiten:385/386. Kontaktinfo9/10,Code1:NachChatdesign-
Auswahl und erneutemÖffnen bleibt `.kp__zeileText` nicht innerhalb der festen
3000ms sichtbar. Alle anderenKontaktfunktionen inklusiveGruppenanruf grün;
Henrik,Insel,Optionen,Kasten8,Kamera undEinstellungen vollständigCode0.
Keine pauschale Netzursache behauptet. Statisch lädt openContactProfile
Profil,Medien undKryptostatus nacheinander; ob bloßeLatenz oder eine
späteCallback-Reihenfolge denFehler verursacht,wird nach Ende dieses
unverändertenLaufs mitOriginaltest undergänzender Anfrage-/Sichtbarkeitsmessung
untersucht. Messvorspann inpruefbelege/paket67-abschluss/kontaktinfo-messung.cjs;
ersetzt keineAntworten,ändert keineProdukt-/Testsourcen. KeineParallel-Liveprobe.

## Vollständiger Lauf639f542b beendet — fünf Gruppen zu korrigieren

102/102Suiten,3385/3399,Code1;Quellenunverändert;Originaljournal503Mitteilungen
entfernt,Rest0. Vier weitere Fehlergruppen nebenKontaktinfo:Krypto22/23 verglich
ein bewusstesFormat1-Paket ohneKontext mitderaktuellenFormatkonstante2.
Die drei altenMigration/Kontenlisten-Treiber0/4 verwendeten weder historische
Serverzuordnung nochderen neueAbfrageverträge undverlangten sogar dasEntfernen
derjetzt bewusst erhaltenenRettungskopie. AttrappenundErwartungen korrigiert,
keineProduktlogikfür grüneTests zurückgedreht:jeweils4/4. DefekteKontenlisten
werden jetzt beimWiederfinden einerKontokopie nach frühergelöschtemGlobalfach
geprüft; Servernachweis bleibtzwingend. NeuerAccount übernimmt keineAltkopie.
Kryptotest trenntjetzt Format1-Kompatibilität undFormat2-Version/Rundreise.
Original-Kontaktinfo-Test mitzusätzlicherMessung läuftohneQuelländerung;
Offline-Latenzprobe zeigt drei seriell wartende450ms-Quellen:1363msbis zur
fertigenOriginalansicht. Dasist ein reproduzierbarerLatenzbefund,nochkeine
pauschaleErklärung derLive-Zeitgrenze.

## 17.11.,06:54 — alle fünf Fehlergruppen gezielt grün

Original-Kontaktinfo-Wiederholung auf unverändertem Produkt10/10,Code0;
Anfrage-/Sichtbarkeitsmessung2290/2294/2802ms. Drei unabhängige Datenquellen
liefen seriell, wodurch die bestehende3sGrenze wenig Reserve hatte.
Profil,Medien undKryptostatus laden jetzt parallel; ursprünglicherUI-Test
unverändert10/10,Code0,gemessene1291/1292/1280ms. VollständigOffline mit
drei kontrollierten450msQuellen:Alt1363ms,Neu456ms;Originalansicht mit17Zeilen
undDark-Auswahl,keine externenAnfragen. KeineFristverlängerung imKontakt-Test.
Prüfhelfer erkenntnach abgeschlossenerSitzungswiederherstellung einAnmeldefenster
und wartet davor nichtmehr zweimal15saufverborgeneNutzerdaten. ZweiGegenproben
stellenSitzungswartezeit undunverkürzteDatenprüfung angemeldeterKonten sicher.
Paket7Regression+Stummjetzt23/23,TypeScript0,Offline10/10Gruppen.
Kryptotest25/25live,die dreiÜbernahmegruppen jeweils4/4mitCode0.
Neuer kompletter102erNachweis folgt,die fünf zuvorrotenGruppen zuerst.

## Alte eigene Arbeitskopie bereinigt, Rohdaten erhalten

`paket-7-fortsetzung` bleibt auf1eef00b undist jetztgitsauber.246eigene
Rohbelege/erzeugteBilder (3347702Bytes) unverändert mitSHA256-Manifest unter
`~/allmedia-wt-codex/rohbelege-paket67-2026-11-17/fortsetzung` archiviert;
196ignorierteOriginalbelege bleiben zusätzlichamaltenOrt. Nur eigeneerzeugte
Bilder/Fixture-Metadaten zurückgestellt undgesicherteungetrackteSitzungslogs
verschoben;keineQuelländerungundkeineFremdänderungzurückgedreht. Der ursprüngliche
Paket7-Worktree mitClaudes erzeugtenDateien bleibtunangetastet.
NeuerVollnachweis48dc37b0auf1dbcd04läuftunabhängig (PID65397,Server64886).
Die fünf zuvorrotenGruppen darin bereits gemeinsam47/47,alleCode0.

## 17.11. — Feedback-Folgefehler und neuer Kontakt-Kontextbefund

48dc37b0 kontrolliert beendet:17/102,365/369,Code143,Quellenunverändert,
151Mitteilungen entfernt,Rest0. Feedback28/32 mitfehlenderAnfragekarte;
Greta-Chatfläche blockierteFolgeklicks. Optionen13/13 durchkontrollierten
Abbruch unvollständig,keinbehaupteterProduktfehler. UnveränderterFeedback-
Messlauf vollständiggrün; Vorbereitung2098ms,Kryptofakten501ms,Speichern2578ms,
Anfragekarte6338ms nachKlick. Testwartetjetzt aufdie tatsächlichgespeicherte
Erstnachricht unddanachweiterhinmax8saufdieKarte;unabhängigesChat-Schließen
verhindertFolgefehler.

DieMessung zeigteauch zwei verschiedeneChat-IDs:VorbereitungohneKontakt
wähltCommunitys,nachKontaktanlageMessenger. MitregistriertemEmpfängergerät
bindetFormat2denTextandenCommunity-Chat;derServerlehntdenVersandindenneuen
Messenger-Kontextab. EchteBrowserfunktion+echteServerrouten/Krypto,inSpeichertabellen
mitnachgebildeterBereichswahl reproduziert:0Nachrichten,Kontextfehler. Kein
angeblichesNetzproblem. Korrektur:wieinderAppzuerstKontaktundendgültigenChat
anlegen,danachfürdieseIDverschlüsselnundsenden. DieunbenutzteVorbereitungsroute
entfernt. FehlererhältEntwurf,fixiertdenangelegtenEmpfängerundermöglichtWiederholung
imselbenChat,ohneDuplikate.

Die normaleServer-Schreibsperre erlaubtjetztexaktdieersteNachrichtimnochleeren
ZweierchatdesanfragendenErstellers;weiterebleibengesperrt. UnveränderteDatenbank-RLS
entscheidetweiterhinbeimInsert. KeineRechte-/Schemaänderung. Lese-/Zählfehler
bleibenimZweifelgesperrt. ErweiterteOffline-Browserprüfung37/37:Format2öffnungsfähig,
richtigerBereich/ID,keineverwaisteVorbereitung,keinzweitesSchreibenvorAnnahme,
Kuvertfehler/Entwurf/Retry,Doppeltipp/EmpfängerbindungundFail-closed. DieGruppe
gehörtjetztzumvollständigenNachweis,damit103Suiten. Live-Zwei-Konten-Gegenprobe
undneuerVollnachweisfolgen.

## 17.11. — Kontaktkorrektur real abgenommen, Feedback vollständig grün

ErweiterteOffline-Browserprüfung38/38. Ein angenommener/offenerZweierchat
bleibtbeschreibbar,auchwenncontacts.statusnochpendingmeldet;maßgeblichistdie
tatsächlicheChatanfrage. Pending-Erstnachricht bleibt aufleeren,selbsterstellten
ChatmitpassenderAnfragezuordnung begrenzt,Lese-/Zählfehlerbleibengesperrt.
EchteTestkonten:10/10,Code0;privatesEmpfängerprofil,Format2-Erstnachrichtvom
Gegenüberentschlüsselt,originaleAnfragekarte/gesperrtesEingabefeld,abgewiesene
zweiteAPI-Nachricht,dannweitereNachrichtnachechterAnnahme. RealeKontaktmaske
erhältnachgezieltemHTTP-SendeausfallEntwurf,EmpfängerbindungundRetry. Keine
zusätzlicheCommunity-Vorbereitung. AlleProbechats/Mitglieder/Nachrichten,
GeräteschlüsselundneueMitteilungenentfernt,Rest0;Empfängerprofilwiederhergestellt.
Belegekontakt-live-ergebnis.jsonundkontakt-live-fixtures.json;Bildergesichtet.
DasBildderFehlermaskemitgeschützterTestnummerliegtprivatimRoharchiv
rohbelege-paket67-2026-11-17/kontakt-live,gehtnichtinsRepository.
FeedbacknachKorrektur53/53,Code0,keineKonsolenfehler. Neue103erVollwiederholung
aufgefrorenemStandfolgt. KeineweiterenProduktänderungen währendderMessung.

## 17.11. — Vollnachweis 54a2008c kontrolliert unterbrochen

Unveränderter Produktstand e5b2b08: 32/103 abgeschlossene Gruppen,
731/735 Prüfungen, Exit 143 nach kontrolliertem Abbruch. 270 Testmitteilungen
entfernt, Rest 0. Unterbrochene Gruppe pfeile besitzt keine vollständige Wertung.
Belege: vollstatus-54a2008c.json, vollprotokoll-54a2008c.log, vollcode-54a2008c.txt.

Community-Glocke überschritt die bisher ab Klick gemessene 3s-Grenze; das später
geöffnete Blatt blockierte zwei folgende Erstellen-Prüfungen. Der Test wartet
jetzt zuerst auf die tatsächliche HTTP-Antwort, behält danach 3s für die UI und
schließt das Blatt auch bei Fehlern. Kontaktkarte fehlte innerhalb von 10s;
die unveränderte instrumentierte Einzelwiederholung bestand 13/13. Damit ist
die ursprüngliche Ursache nicht abschließend bewiesen. Die Kontaktprüfung
trennt jetzt erfolgreiche Persistierung und anschließende 10s-Darstellung und
meldet Serverfehler ausdrücklich. Keine Produktänderung für diese beiden Befunde.

Gezielte Erstellen-Diagnose mit protokollierten HTTP-Statuscodes und beobachtetem
Toast-Lebenszyklus: 19/19, Exit 0, keine Konsolenfehler. Der Hinweis verschwand
regulär nach ungefähr 2,5s; Community-Antwort HTTP 200, alle Folgeprüfungen grün.
Die vorherige unveränderte Einzelmessung war 15/19 mit einem zusätzlichen
401 beim Sammlungsabruf; ein Diagnose-Start scheiterte vor den Prüfungen an der
60s-Grenze für page.evaluate. Diese Fehlversuche bleiben als Belege erhalten;
sie werden nicht in einen erfolgreichen Gesamtnachweis umgedeutet.

## 17.11. — Langsame Anhangantworten und fremde Chatansichten

Instrumentierung zeigt Kontakt-Vorbereitung HTTP 200 nach 550ms, abschließende
Anhangantwort HTTP 200 erst nach 47.251ms. Eine weitere Messung zeigt einen
Schlüssellesezugriff /rest/v1/krypto_schluessel mit 98.178ms. Das ist beobachtete
Backend-Latenz; ihre externe Ursache ist nicht abschließend belegt. Kontakt-
und Fototest warten nun bis zu 60s auf erfolgreiche Persistierung, anschließend
unverändert 10s beziehungsweise 15s auf Darstellung. Keine automatischen Retries.

Zusätzlich wurde ein echter Rückkehrfehler sichtbar: nach Verlassen des Chats
schrieb eine verspätete Anhangantwort in state.messages und rief paintMessages
ohne Nachrichtenansicht auf. Sie konnte ebenso einen inzwischen anderen Bezug
löschen. zielChat bindet beide Abschluss-Callbacks jetzt an Konto, Chat-ID und
Öffnungsgeneration. Drei reproduzierbare Gegenproben mit Originalfunktion:
alter Code 0/3, Korrektur 3/3. Gesamte Paket7-Regressionsdatei 17/17,
Offline-Browserprüfung unverändert 38/38, jeweils Exit 0. Kein Schemaeingriff.
Der lokale Backend-Diagnoserahmen protokolliert nur Pfad, Laufzeit und Status,
keine Token oder Anfrageparameter. Eigene Wachhaltung während lokaler Tests.

## 17.11. — Eigene unvollständige Nummern-Bereinigung korrigiert

Vollnachweis abc3d0a7 wurde kontrolliert nach 57/103 Gruppen beendet:
1439/1468 Prüfungen, Exit 143, Quellen unverändert, 453 Testmitteilungen entfernt,
Rest 0. Das Ergebnis bleibt fehlerhaft und unvollständig. Zusätzlich zu den
bekannten Laufzeit-/Netzwerkfehlern scheiterte messengeranfrage mit 14/37.

Ursache der Zustimmungs-Kaskade war ein eigener Testrest: kontakt-live hatte
zwar Kontakte, Chats, Nachrichten, Schlüssel und Mitteilungen entfernt, aber
den durch finde_per_nummer gesetzten Nachweis nummer_treffer vergessen. Die
bisherigen Rest-0-Aussagen dieser Probe waren auf die aufgezählten Tabellen
begrenzt und als vollständige Bereinigung unzutreffend. Ein Treffer A→B vom
17.11. 06:44:52.662726 UTC passt zur tatsächlichen Kontaktprobe bis 06:45:01 UTC.
Exakt diese eigene Zeile wurde entfernt; Gegenrichtung aus dem Bestandslauf
blieb erhalten. Kein Produkt-/RLS-Fehler daraus behauptet.

Die Probe sichert jetzt ihren A→B-Nummerntreffer einschließlich Zeit und die
vorherigen Suchzähler-IDs, stellt den Treffer nach der Probe exakt wieder her
und entfernt nur neu entstandene Suchzähler. Die Differenz gehört zur Restzahl.
Der Negativtest messengeranfrage bricht bei einem vorhandenen Nummernnachweis
vor der ersten Mutation mit klarer Prüfvoraussetzung ab. Neue Live-Abnahme
und ungeänderte Zustimmungsgegenprobe folgen vor erneutem Vollnachweis.

Erneute Kontaktprobe mit erweiterter Baseline: 10/10, Exit 0, eigene
Nummerntreffer-/Zählerdifferenz 0, Gesamt-Rest 0, Empfängerprofil wiederhergestellt.
Anschließend echte Messenger-Zustimmungsprüfung 37/37, Exit 0; die andere
Suchrichtung aus dem früheren Bestandslauf blieb dabei unverändert erhalten.
Das bestätigt die Testkontamination; kein Anlass für neue RLS-/Produktänderung.
Der nächste Vollnachweis beginnt mit dieser Gruppe und hält Bildschirm sowie
System für die Dauer des eigenen Prüfprozesses wach.
