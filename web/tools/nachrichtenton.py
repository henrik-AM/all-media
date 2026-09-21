#!/usr/bin/env python3
"""Erzeugt den Nachrichtenton für App und Website.

Der Ton wird hier aus einer Sinuswelle gerechnet und nicht irgendwo
heruntergeladen — so gibt es keine Lizenzfrage und keine Datei, deren
Herkunft niemand mehr kennt.

Beide Ziele bekommen dieselben Bytes: `app/assets/nachricht.wav` und
`web/public/nachricht.wav`. App und Website klingen gleich, weil es derselbe
Ton ist, nicht zwei ähnliche.

    python3 web/tools/nachrichtenton.py

Aufruf aus dem Projektverzeichnis (All-Media/).
"""

import math
import os
import struct
import wave

RATE = 44100
ZIELE = ('app/assets/nachricht.wav', 'web/public/nachricht.wav')


def ton(frequenz, dauer):
    """Ein Sinuston mit weicher Hülle — sonst knackt es an den Rändern."""
    for i in range(int(RATE * dauer)):
        t = i / RATE
        huelle = min(1.0, t / 0.008, (dauer - t) / 0.03)
        yield 0.28 * huelle * math.sin(2 * math.pi * frequenz * t)


def main():
    # Zwei aufsteigende Töne: kurz genug, um beim zehnten Mal nicht zu nerven.
    proben = list(ton(880, 0.055)) + list(ton(1318, 0.09))
    daten = b''.join(
        struct.pack('<h', int(max(-1.0, min(1.0, p)) * 32767)) for p in proben
    )

    for ziel in ZIELE:
        os.makedirs(os.path.dirname(ziel), exist_ok=True)
        with wave.open(ziel, 'wb') as datei:
            datei.setnchannels(1)
            datei.setsampwidth(2)
            datei.setframerate(RATE)
            datei.writeframes(daten)
        print(f'{ziel}  {os.path.getsize(ziel)} Bytes')


if __name__ == '__main__':
    main()
