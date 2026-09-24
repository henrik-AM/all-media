#!/usr/bin/env python3
"""Erzeugt Hörproben und Cover für die fünf Test-Sounds.

Henrik am 21.09.2026: "Songs: Abspielen, nur die aktuell gesungene
Textzeile, Songwriter-Name, offizielles Songbild." Die Test-Sounds sind
erfunden - es gibt kein offizielles Bild und keine Aufnahme, die man
laden dürfte. Deshalb wie beim Nachrichtenton: selbst gerechnet, keine
Lizenzfrage.

Jede Hörprobe ist 30 Sekunden lang, wie ein Sound-Ausschnitt bei TikTok,
und eine kleine Melodie aus Sinustönen. Das Cover ist ein Farbverlauf.
Beides landet in `web/public/sounds/`; Render liefert es aus, und
SUPABASE_SCHEMA_54_songs.sql trägt die Adressen ein.

    python3 web/tools/testsounds.py

Aufruf aus dem Projektverzeichnis (All-Media/). Braucht ffmpeg.
"""

import math
import os
import struct
import subprocess
import wave

RATE = 22050
LAENGE = 30.0
ZIEL = 'web/public/sounds'

# slug, Grundton in Hz, Tonfolge in Halbtönen, Farben fürs Cover
SOUNDS = [
    ('golden-hour', 220.0, [0, 4, 7, 12, 7, 4], ('0xF7B267', '0xF25C54')),
    ('lo-fi-focus', 196.0, [0, 3, 7, 10, 7, 3], ('0x5B5F97', '0x1B1B3A')),
    ('kitchen-groove', 246.9, [0, 5, 7, 9, 7, 5], ('0xF4D35E', '0xEE964B')),
    ('runner-high', 261.6, [0, 7, 12, 7, 5, 4], ('0x06D6A0', '0x118AB2')),
    ('ambient-sunrise', 174.6, [0, 7, 11, 14, 11, 7], ('0xFFD6A5', '0x9BF6FF')),
]


def melodie(grund, folge):
    """Eine Note je halbe Sekunde, weiche Hülle, darunter ein leiser Grundton."""
    note = 0.5
    for i in range(int(RATE * LAENGE)):
        t = i / RATE
        schritt = int(t / note)
        in_note = t - schritt * note
        f = grund * 2 ** (folge[schritt % len(folge)] / 12)
        huelle = min(1.0, in_note / 0.02, (note - in_note) / 0.12)
        gesamt = min(1.0, t / 1.0, (LAENGE - t) / 2.0)
        wert = 0.28 * huelle * math.sin(2 * math.pi * f * t)
        wert += 0.12 * math.sin(2 * math.pi * grund / 2 * t)
        yield max(-1.0, min(1.0, wert * gesamt))


def main():
    os.makedirs(ZIEL, exist_ok=True)
    for slug, grund, folge, (von, bis) in SOUNDS:
        roh = os.path.join(ZIEL, f'{slug}.wav')
        with wave.open(roh, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(b''.join(struct.pack('<h', int(x * 32767)) for x in melodie(grund, folge)))
        subprocess.run(
            ['ffmpeg', '-y', '-loglevel', 'error', '-i', roh, '-c:a', 'aac', '-b:a', '64k',
             os.path.join(ZIEL, f'{slug}.m4a')],
            check=True,
        )
        os.remove(roh)
        subprocess.run(
            ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi',
             '-i', f'gradients=s=512x512:c0={von}:c1={bis}:x0=0:y0=0:x1=512:y1=512:d=1',
             '-frames:v', '1', os.path.join(ZIEL, f'{slug}.jpg')],
            check=True,
        )
        print('geschrieben:', slug)


if __name__ == '__main__':
    main()
