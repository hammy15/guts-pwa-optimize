# How to Deploy GUTS PWA Optimizations

## Option 1: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/hammy15/guts-mvp
2. Click "Settings" → "Functions" or source view
3. Download current source OR...
4. Use Vercel CLI to pull and modify locally

## Option 2: Manual File Replacement

Since the project has no linked Git repo, files need to be replaced in the Vercel deployment directly.

### Files to Replace:

**1. /public/sw.js**
Replace with contents of: sw-optimized.js

**2. /public/manifest.json** 
Replace with contents of: manifest-optimized.json

**3. /hooks/useOfflineGame.ts** (NEW FILE)
Add the new file from: hooks/useOfflineGame.ts

### To Apply:

```bash
# 1. Clone this optimization repo
git clone https://github.com/hammy15/guts-pwa-optimize

# 2. Copy files to guts source
cp guts-pwa-optimize/sw-optimized.js /path/to/guts/public/sw.js
cp guts-pwa-optimize/manifest-optimized.json /path/to/guts/public/manifest.json
cp -r guts-pwa-optimize/hooks /path/to/guts/

# 3. Redeploy
vercel deploy --prod
```

## Option 3: Have Max/Owner Provide Source

The GUTS source was deployed directly to Vercel without a Git repo.
Someone with access to the original source needs to:
1. Share the source files
2. Or link a GitHub repo to the Vercel project
3. Then I can push updates directly

## GitHub Repo for This Package
https://github.com/hammy15/guts-pwa-optimize
