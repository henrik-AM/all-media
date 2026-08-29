#!/bin/bash

# ============================================================================
# Render Environment Setup — EINMALIG ausführen
# ============================================================================
# Dieses Script setzt die Supabase Environment-Variablen auf Render
# Benutzung: ./scripts/setup-render.sh YOUR_RENDER_API_TOKEN
# ============================================================================

set -e

API_TOKEN="${1}"
SERVICE_ID="srv_ppg6s1v14grn8d3g7c40"  # all-media-website service ID

if [ -z "$API_TOKEN" ]; then
  echo "❌ FEHLER: Render API Token erforderlich"
  echo ""
  echo "Benutzung:"
  echo "  ./scripts/setup-render.sh YOUR_RENDER_API_TOKEN"
  echo ""
  echo "API Token bekommen:"
  echo "  1. Gehe zu https://dashboard.render.com/account/tokens"
  echo "  2. Klick 'Create API Token'"
  echo "  3. Kopiere den Token"
  echo "  4. Führe dieses Script aus: ./scripts/setup-render.sh <TOKEN>"
  exit 1
fi

echo "🔧 Setze Supabase Environment-Variablen auf Render..."
echo ""

# Variable 1: SUPABASE_URL
echo "📝 Setze SUPABASE_URL..."
curl -X PUT \
  "https://api.render.com/v1/services/${SERVICE_ID}/env-vars/SUPABASE_URL" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"value":"https://ijztosbjfybdgotpdixw.supabase.co"}' \
  2>/dev/null

if [ $? -eq 0 ]; then
  echo "✅ SUPABASE_URL gesetzt"
else
  echo "❌ Fehler beim Setzen von SUPABASE_URL"
  echo "   Prüfe: API Token korrekt? Service ID korrekt?"
  exit 1
fi

echo ""

# Variable 2: SUPABASE_ANON_KEY
echo "📝 Setze SUPABASE_ANON_KEY..."
curl -X PUT \
  "https://api.render.com/v1/services/${SERVICE_ID}/env-vars/SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"value":"sb_publishable_sh_LhLSMkHNZrmmj7XkTtw_QFT1G9Ze"}' \
  2>/dev/null

if [ $? -eq 0 ]; then
  echo "✅ SUPABASE_ANON_KEY gesetzt"
else
  echo "❌ Fehler beim Setzen von SUPABASE_ANON_KEY"
  exit 1
fi

echo ""
echo "🎉 ERFOLG!"
echo ""
echo "Environment-Variablen auf Render gesetzt:"
echo "  ✅ SUPABASE_URL"
echo "  ✅ SUPABASE_ANON_KEY"
echo ""
echo "📡 Website wird automatisch neu deployed..."
echo "   (Warte ~2-3 Minuten, dann https://all-media-website.onrender.com neu laden)"
echo ""
echo "✨ Fertig! Website ist jetzt mit Supabase verbunden."
