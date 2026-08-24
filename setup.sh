#!/bin/bash

# All Media App Setup Script
# Automates initial setup for local development

set -e

echo "🚀 All Media App Setup"
echo "====================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+."
    exit 1
fi

echo "✓ Node.js $(node --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
cd app
npm install --legacy-peer-deps
echo "✓ Dependencies installed"
echo ""

# Create .env.local if it doesn't exist
if [ ! -f app/.env.local ]; then
    echo "📝 Creating .env.local template..."
    cat > .env.local << EOF
# Supabase Configuration
# Choose ONE option:

# Option 1: Local Supabase (Docker)
# EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
# EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Option 2: Supabase Cloud
# EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Test Account (Mock)
# Email: test@example.com
# Password: password123
EOF
    echo "✓ .env.local created"
    echo "  ⚠️  Fill in your Supabase credentials to enable live features"
else
    echo "✓ .env.local already exists"
fi
echo ""

# Offer to start the app
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo ""
echo "1️⃣  Start Expo (React Native):"
echo "    npm start"
echo ""
echo "2️⃣  (In another terminal) Start Web App:"
echo "    node web-app.js"
echo ""
echo "3️⃣  Or start both:"
echo "    npm run dev  (if configured)"
echo ""
echo "📖 Read SUPABASE_SETUP.md for backend integration"
echo ""
echo "Questions? Check README.md or PHASE_3_INTEGRATION.md"
