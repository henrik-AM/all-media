#!/usr/bin/env python3
"""Rechnet die Wellenform der Hörproben aus den Tondateien.

Kasten 7.5 (Feedback 21.09.2026): Die Soundseite zeigt wie im Prototyp
(Frame „VSSo + Sound") eine Wellenform aus 75 Balken. Bis hier war sie in
App und Website mit sin() gezeichnet - bei jedem Song dieselbe Form. Jetzt
steht die Lautstärke der echten Aufnahme in sounds.wellenform
(Schema 67), und App und Website zeichnen nur noch, was dort steht.

Für jede Datei in web/public/sounds/ wird der Ton über ffmpeg als Mono-PCM
gelesen, in 75 gleich lange Abschnitte geteilt, je Abschnitt der
Effektivwert (RMS) gebildet und auf den lautesten Abschnitt normiert
(0..1). Dazu die Länge in Sekunden (sounds.hoerprobe_sek).

Ausgabe sind SQL-Anweisungen auf stdout, zugeordnet über sounds.audio_url:

    python3 web/tools/wellenform.py > /tmp/wellenform.sql

und dann einspielen wie jede Schema-Datei. Die Ausgabe für die fünf
Test-Sounds steht auch am Ende von SUPABASE_SCHEMA_67_sound_nutzung.sql.
Aufruf aus dem Projektverzeichnis (All-Media/). Braucht ffmpeg.
"""

import array
import math
import os
import subprocess

ORDNER = 'web/public/sounds'
BALKEN = 75
RATE = 8000


def lesen(pfad):
    roh = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', pfad, '-ac', '1', '-ar', str(RATE),
         '-f', 's16le', '-'],
        check=True, capture_output=True).stdout
    werte = array.array('h')
    werte.frombytes(roh)
    return werte


def wellenform(werte):
    je = max(1, len(werte) // BALKEN)
    rms = []
    for i in range(BALKEN):
        stueck = werte[i * je:(i + 1) * je]
        rms.append(math.sqrt(sum(w * w for w in stueck) / len(stueck)) if stueck else 0.0)
    hoechster = max(rms) or 1.0
    return [round(r / hoechster, 3) for r in rms]


def main():
    for name in sorted(os.listdir(ORDNER)):
        if not name.endswith('.m4a'):
            continue
        werte = lesen(os.path.join(ORDNER, name))
        form = wellenform(werte)
        sek = round(len(werte) / RATE, 1)
        liste = ','.join(str(w) for w in form)
        print(f"update public.sounds set wellenform = '{{{liste}}}', hoerprobe_sek = {sek} "
              f"where audio_url = '/sounds/{name}';")


if __name__ == '__main__':
    main()
