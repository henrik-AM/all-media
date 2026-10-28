# Gesamtläufe main und Bunny

Gleiche Live-Datenbank einschließlich Schema 115; main ohne Bunny. OK bedeutet Exit 0, FEHL einen nicht erfolgreichen Prozess, ZEIT einen unvollständigen Lauf nach 15 Minuten. Die Prüfzahlen enthalten nur tatsächlich gezählte Zeilen.

| Lauf | main | bunny-live |
|---|---|---|
| smoke | FEHL 75/75 | FEHL 75/75 |
| feedback | FEHL 51/52 | FEHL 52/52 |
| erstellen | FEHL 19/19 | FEHL 19/19 |
| teilen | FEHL 25/25 | FEHL 25/25 |
| sync | FEHL 5/6 | FEHL 5/6 |
| uebernacht | FEHL 11/11 | FEHL 11/11 |
| schema | FEHL 6/7 | OK 7/7 |
| sammlungen | OK 16/16 | OK 16/16 |
| sammlungenweb | FEHL 23/23 | FEHL 23/23 |
| explorer | FEHL 21/21 | FEHL 20/21 |
| anhang | FEHL 12/12 | FEHL 12/12 |
| einstellungen | FEHL 19/19 | FEHL 19/19 |
| kontaktinfo | FEHL 10/10 | FEHL 10/10 |
| henrik | FEHL 23/23 | FEHL 23/23 |
| henrik2 | FEHL 19/19 | FEHL 19/19 |
| insel | FEHL 17/17 | FEHL 17/17 |
| suche | ZEIT ohne Zählung | FEHL 13/13 |
| optionen | ZEIT ohne Zählung | FEHL 16/16 |
| kasten8 | FEHL 6/6 | FEHL 6/6 |
| kasten12 | OK 65/65 | OK 65/65 |
| kasten17 | OK 53/53 | OK 53/53 |
| glocke | FEHL 20/21 | FEHL 20/21 |
| pfeile | FEHL 67/68 | FEHL 67/68 |
| profil | FEHL 22/22 | ZEIT 22/22 |
| community | FEHL 24/24 | FEHL 24/24 |
| chatoptionen | FEHL 17/17 | FEHL 17/17 |
| player | FEHL 15/15 | FEHL 15/15 |
| gesten | FEHL 9/9 | FEHL 9/9 |
| kommentare | FEHL 9/9 | FEHL 9/9 |
| querformat | FEHL ohne Zählung | FEHL ohne Zählung |
| feinschliff | FEHL 23/23 | FEHL 23/23 |
| kamera | FEHL 10/10 | FEHL 10/10 |
| eigenes | FEHL 18/19 | FEHL 19/19 |
| datenbank | FEHL 26/27 | FEHL 26/27 |
| aktionen | FEHL 43/43 | FEHL 43/43 |
| gleichstand | FEHL 50/50 | OK 50/50 |
| handbuch | FEHL 25/27 | FEHL 25/27 |
| sichtbarkeit | FEHL 28/33 | FEHL 28/33 |
| likes | FEHL 73/73 | FEHL 73/73 |
| fremdprofil | OK 14/14 | OK 14/14 |
| chatanfrage | OK 17/17 | OK 17/17 |
| messengeranfrage | OK 37/37 | OK 37/37 |
| mitteilungen | OK 24/24 | OK 24/24 |
| dmsperre | FEHL 14/16 | FEHL 14/16 |
| lesebestaetigung | OK 13/13 | OK 13/13 |
| kanal | FEHL 12/12 | FEHL 12/12 |
| impressionen | OK 17/17 | OK 17/17 |
| rang | OK 34/34 | OK 34/34 |
| verlauf | OK 45/45 | OK 45/45 |
| storyvideos | OK 13/13 | OK 13/13 |
| storys | OK 24/24 | OK 24/24 |
| krypto | OK 23/23 | OK 23/23 |
| rechte | OK 187/187 | OK 197/197 |
| minderjaehrig | OK 41/41 | OK 41/41 |
| elternnummer | FEHL 13/13 | FEHL 13/13 |
| bremse | OK 10/10 | OK 10/10 |
| auth | OK 9/9 | OK 9/9 |
| zahlung | OK 94/94 | OK 94/94 |
| stumm | OK 21/21 | OK 21/21 |
| storyvideoregeln | OK 27/27 | OK 27/27 |
| kasten16-19 | OK 42/42 | OK 42/42 |
| farbfilterrechnung | OK 58/58 | OK 58/58 |
| farbfilter | FEHL 15/16 | FEHL 15/16 |
| bildschirmzeit-einheit | OK 78/78 | OK 78/78 |
| bildschirmzeit | FEHL 59/59 | FEHL 59/59 |
| vorschlaege | FEHL 69/69 | FEHL 69/69 |
| lenkung-einheit | OK 57/57 | OK 57/57 |
| lenken | FEHL 42/42 | OK 42/42 |
| markierung-einheit | OK 50/50 | OK 50/50 |
| markieren | FEHL 46/49 | FEHL 46/49 |
| chatsync | FEHL 39/39 | FEHL 38/39 |
| **Gezählte Prüfungen** | **2199/2219** | **2239/2258** |
| **Exit 0** | **26/71** | **29/71** |
| **Nicht erfolgreich einschließlich Zeitgrenze** | **45/71** | **42/71** |
| **Davon Zeitgrenze** | **2/71** | **1/71** |

## Abweichende Zeilen

- feedback: main FEHL 51/52, Bunny FEHL 52/52.
  - main: FEHL Aufnahme wird übernommen  — new row for relation "stories" violates check constraint "stories_media_url_eigener_eimer"
- schema: main FEHL 6/7, Bunny OK 7/7.
  - main: FAIL  Alle angesprochenen Spalten gibt es im Schema  — web/server/sync-handlers.js:838  community_channels.1
- explorer: main FEHL 21/21, Bunny FEHL 20/21.
  - Bunny: FEHL Der Abspielknopf laesst die Zeit laufen — Zeit steht bei 0:00 / 0:30
- suche: main ZEIT ohne Zählung, Bunny FEHL 13/13.
- optionen: main ZEIT ohne Zählung, Bunny FEHL 16/16.
- profil: main FEHL 22/22, Bunny ZEIT 22/22.
- eigenes: main FEHL 18/19, Bunny FEHL 19/19.
  - main: FEHL Videos-Profil zeigt die Info aus dem Konto — die geaenderte Info steht nicht auf der Seite
- gleichstand: main FEHL 50/50, Bunny OK 50/50.
- rechte: main OK 187/187, Bunny OK 197/197.
- lenken: main FEHL 42/42, Bunny OK 42/42.
- chatsync: main FEHL 39/39, Bunny FEHL 38/39.
  - Bunny: FEHL … und bei B steht genau dieser Text, ohne Neuladen (≤ 15 s)

Quellstandänderung gemeldet: main false, Bunny false.
Automatisch entfernte Mitteilungen: main 445, Bunny 465. Separate Nachzählung siehe 06-bereinigung.txt.
