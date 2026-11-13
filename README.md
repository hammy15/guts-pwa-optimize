# GUTS PWA Optimization — Complete Package

## Overview

This package optimizes the GUTS card game for Progressive Web App (PWA) best practices:

| Feature | Before | After |
|---------|--------|-------|
| **Offline play** | ❌ Crashes | ✅ Full solo mode |
| **Install prompt** | ✅ Basic | ✅ Enhanced with shortcuts |
| **Cache strategy** | Network-first | Stale-while-revalidate |
| **Background sync** | ❌ None | ✅ Queue scores offline |
| **Push notifications** | ✅ Basic | ✅ Full routing |
| **Game state persistence** | ❌ Lost on close | ✅ Resume where you left off |
| **Assets prefetched** | 12 files | 50+ files |

---

## Files to Deploy

### 1. Replace `/public/sw.js` with `sw-optimized.js`

Key improvements:
- **Stale-while-revalidate** — Instant loads + fresh data
- **Game asset prefetch** — Sounds, cards, avatars cached on install
- **Offline fallback page** — Graceful degradation
- **Background sync** — Scores queue when offline, sync when reconnected
- **Game state caching** — Resume interrupted games

### 2. Replace `/public/manifest.json` with `manifest-optimized.json`

New features:
- **4 app shortcuts** — Play, Daily Challenge, Tournaments, Leaderboard
- **Share target** — Share links into the app
- **Protocol handler** — `web+guts://` deep links
- **Better screenshots** — Higher resolution for app stores

### 3. Add React hooks from `/hooks/useOfflineGame.ts`

Three hooks:
- `useOfflineGame()` — Save/restore game state, queue scores
- `usePWAInstall()` — Custom install prompt handling
- `usePushNotifications()` — Permission + subscription management

---

## Integration Steps

### Step 1: Update Service Worker

\`\`\`bash
# Copy optimized SW
cp sw-optimized.js /path/to/guts/public/sw.js
\`\`\`

### Step 2: Update Manifest

\`\`\`bash
# Copy optimized manifest
cp manifest-optimized.json /path/to/guts/public/manifest.json
\`\`\`

### Step 3: Add Hooks to Components

\`\`\`tsx
// In GameBoard.tsx
import { useOfflineGame } from '@/hooks/useOfflineGame';

function GameBoard() {
  const { isOnline, saveGameState, restoreGameState, queueScore } = useOfflineGame();
  
  // Save state after each round
  useEffect(() => {
    saveGameState({
      pot,
      playerChips,
      playerHand,
      aiHands,
      currentRound,
      difficulty,
      playerCount,
    });
  }, [pot, playerChips, currentRound]);
  
  // Restore on mount
  useEffect(() => {
    restoreGameState().then((state) => {
      if (state && Date.now() - state.timestamp < 3600000) {
        // Resume game less than 1 hour old
        setShowResumeModal(true);
      }
    });
  }, []);
  
  // Queue score when game ends
  const handleGameEnd = async (finalScore: number) => {
    const synced = await queueScore({
      score: finalScore,
      difficulty,
      rounds: currentRound,
      timestamp: Date.now(),
      synced: false,
    });
    
    if (!synced) {
      toast.info('Score saved - will sync when online');
    }
  };
}
\`\`\`

### Step 4: Update Layout with Offline Banner

\`\`\`tsx
// In layout.tsx
import { useOfflineGame } from '@/hooks/useOfflineGame';

function GameLayout({ children }) {
  const { isOnline, pendingScores } = useOfflineGame();
  
  return (
    <div>
      {!isOnline && (
        <div className="bg-amber-600 text-black text-center py-2 text-sm">
          ⚡ Offline Mode — Solo practice available
          {pendingScores > 0 && ` • ${pendingScores} scores pending sync`}
        </div>
      )}
      {children}
    </div>
  );
}
\`\`\`

---

## PWA Checklist

### Must Have ✅
- [x] Valid manifest.json with icons
- [x] Service worker registered
- [x] HTTPS (Vercel provides)
- [x] Installable (standalone display)
- [x] Offline fallback page
- [x] App shortcuts (4 defined)

### Should Have ✅
- [x] Maskable icon (512x512)
- [x] Screenshots for app stores
- [x] Theme color matches brand
- [x] Background color for splash
- [x] Push notifications ready
- [x] Share target handler

### Nice to Have ✅
- [x] Protocol handler (web+guts://)
- [x] Background sync for scores
- [x] Game state persistence
- [x] Offline score queue
- [x] Asset prefetching

---

## Testing

### Lighthouse PWA Audit
\`\`\`bash
# Run in Chrome DevTools > Lighthouse > PWA
# Target: 100/100 PWA score
\`\`\`

### Offline Testing
1. Open Chrome DevTools > Network
2. Set to "Offline"
3. Reload page — should show offline fallback
4. Start solo game — should work fully
5. Complete game — score should queue
6. Go online — score should sync

### Install Testing
1. Open on mobile Chrome/Safari
2. Should see "Add to Home Screen" prompt
3. Install and open from home screen
4. Should be fullscreen, no browser UI
5. App shortcuts should appear on long-press

---

## Metrics to Track

| Metric | Tool | Target |
|--------|------|--------|
| Lighthouse PWA | Chrome DevTools | 100/100 |
| Install rate | Analytics | 20%+ visitors |
| Offline sessions | SW logs | Track usage |
| Background syncs | SW logs | 95%+ success |
| Push opt-in | Analytics | 30%+ users |

---

## Deployment

\`\`\`bash
# After copying files to guts repo
cd /path/to/guts
git add public/sw.js public/manifest.json hooks/useOfflineGame.ts
git commit -m "feat: Enhanced PWA with offline play, background sync, and game state persistence"
git push

# Vercel will auto-deploy
\`\`\`

---

## Files in This Package

\`\`\`
~/guts-pwa-optimize/
├── README.md                    # This file
├── sw-optimized.js              # Enhanced service worker
├── manifest-optimized.json      # Enhanced manifest
└── hooks/
    └── useOfflineGame.ts        # React hooks for offline support
\`\`\`

---

**Questions?** The PWA is ready to deploy. Just copy files and integrate hooks.
