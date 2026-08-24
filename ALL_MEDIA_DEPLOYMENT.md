# All Media Website — Live auf Render

**Deployment erfolgreich:** 24.08.2026

## 🌐 Wichtige Links

| Was | URL |
|-----|-----|
| **Website (dauerhaft online)** | https://all-media-website.onrender.com |
| **GitHub Repository** | https://github.com/itsmehd77-stack/all-media |
| **Expo Go (lokal)** | exp://ended-floral-departure.ngrok-free.dev |

## 📁 Projektstruktur

- `web/` → Website + API (läuft auf Render, 24/7 online)
- `app/` → React Native App (lokal mit Expo Go, braucht Mac)
- `web/public/` → HTML/CSS/JS der Website
- `web/server/app.js` → Express-Server (shared zwischen lokal & Cloud)

## ⚙️ Auto-Deploy

- **Trigger:** Jeder Push zu `main` auf GitHub
- **Builder:** Render buildet + deployt automatisch (~2 Minuten)
- **Status:** ✅ Grün (alle HTTP 200)

## 📝 Wichtig zu wissen

- **Website-URL bleibt immer gleich:** `https://all-media-website.onrender.com`
- **Expo-Go-QR-Code:** Braucht `npm run up` auf deinem Mac
- **Datenspeicher:** Nur während aktiver Session (RAM, kein Persistent Storage)
- **Bei Updates:** Ich schicke dir den QR-Code + Link (Link bleibt gleich!)

## 🔧 Lokale Befehle

```bash
# Website lokal testen (ohne Cloud)
npm start  # im web/ Ordner

# Website + Expo Go zusammen (über ngrok)
npm run up  # im app/ Ordner
```

## 🚀 Nächste Schritte (Optional)

1. **Persistent Storage:** Supabase-Integration für echte Datenbank
2. **Echte App:** EAS Build für iOS/Android
3. **Custom Domain:** Statt `onrender.com` eine eigene Domain
