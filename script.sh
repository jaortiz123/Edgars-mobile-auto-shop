#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
export CI=true

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Installing..."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt-get update
  sudo apt-get install -y nodejs
fi

cd /workspace
rm -rf edgars-mobile-auto
npm install -g create-vite@latest --loglevel=error
create-vite edgars-mobile-auto --template vanilla --yes --force

cd edgars-mobile-auto
npm install -D tailwindcss@^3 postcss autoprefixer --loglevel=error
cat > postcss.config.cjs <<"POSTCSS"
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
};
POSTCSS

cat > tailwind.config.js <<'TAILWIND'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:   '#0a1a3a',
        light:  '#33C3F0',
        gray:   '#9F9EA1',
        accent: '#F97316',
        white:  '#FFFFFF'
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
    },
  },
  plugins: [],
};
TAILWIND

mkdir -p src/styles
cat > src/styles/main.css <<'CSS'
@tailwind base;
@tailwind components;
@tailwind utilities;
CSS

cat > index.html <<'HTML'
<!doctype html><html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Edgar's Mobile Auto Repair</title>
  <link rel="stylesheet" href="/src/styles/main.css">
</head>
<body class="bg-white text-navy font-sans">
<header class="bg-navy text-white shadow">
  <div class="max-w-6xl mx-auto flex justify-between items-center p-4">
    <div class="flex items-center space-x-2">
      <span class="font-bold text-lg">Edgar's Mobile Auto</span>
    </div>
    <nav class="hidden md:flex space-x-6">
      <a href="#services" class="hover:text-light">Services</a>
      <a href="#about"    class="hover:text-light">About</a>
      <a href="#area"     class="hover:text-light">Service Area</a>
      <a href="#contact"  class="hover:text-light">Contact</a>
    </nav>
    <a href="tel:+15551234567" class="bg-accent text-white px-4 py-2 rounded hover:bg-light transition">Call Now</a>
  </div>
</header>
<main class="max-w-6xl mx-auto p-6 space-y-20">
  <section id="services"><h2 class="text-3xl font-bold mb-6">Services</h2></section>
  <section id="about"><h2 class="text-3xl font-bold mb-6">About Edgar</h2></section>
  <section id="area"><h2 class="text-3xl font-bold mb-6">Service Area</h2></section>
  <section id="contact">
    <h2 class="text-3xl font-bold mb-6">Contact</h2>
    <p class="mb-4">Phone: <a href="tel:+15551234567" class="text-accent font-semibold">(555) 123-4567</a></p>
    <p class="mb-6">Email: <a href="mailto:service@edgarsauto.com" class="text-accent font-semibold">service@edgarsauto.com</a></p>
  </section>
</main>
<footer class="bg-navy text-white text-center py-4">© <span id="year"></span> Edgar's Mobile Auto Repair</footer>
<script>document.getElementById('year').textContent=new Date().getFullYear();</script>
</body></html>
HTML

npm install --loglevel=error
npm run build

echo "✅  Build completed — static site is in /workspace/edgars-mobile-auto/dist"
