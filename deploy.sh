#!/usr/bin/env bash
# Redeploy the dashboard to GitHub Pages (https://krvn031992.github.io/sod-dashboard/).
# Builds with the live keys from .env.local and publishes the result to the
# gh-pages branch. Run from the dashboard/ folder:  bash deploy.sh
set -euo pipefail

cd "$(dirname "$0")"
REPO="https://github.com/krvn031992/sod-dashboard.git"

echo "Building…"
set -a; . ./.env.local; set +a
npm run build
touch dist/.nojekyll

echo "Publishing to gh-pages…"
cd dist
rm -rf .git
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.email="krvn031992@users.noreply.github.com" -c user.name="krvn031992" \
    commit -q -m "Deploy dashboard $(date +%Y-%m-%d)"
git push -q --force "$REPO" gh-pages

echo "Done. Live in ~1 minute at https://krvn031992.github.io/sod-dashboard/"
