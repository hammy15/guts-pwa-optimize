// hooks/useOfflineGame.ts
// React hook for offline game state management with Service Worker

import { useEffect, useState, useCallback, useRef } from 'react';

interface GameState {
  pot: number;
  playerChips: number;
  playerHand: string[];
  aiHands: string[][];
  currentRound: number;
  difficulty: 'casual' | 'standard' | 'expert';
  playerCount: number;
  timestamp: number;
}

interface OfflineScore {
  score: number;
  difficulty: string;
  rounds: number;
  timestamp: number;
  synced: boolean;
}

export function useOfflineGame() {
  const [isOnline, setIsOnline] = useState(true);
  const [isPWA, setIsPWA] = useState(false);
  const [pendingScores, setPendingScores] = useState<number>(0);
  const swRef = useRef<ServiceWorkerRegistration | null>(null);

  // Check online status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    setIsPWA(window.matchMedia('(display-mode: standalone)').matches);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Get SW registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        swRef.current = reg;
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save game state to SW cache
  const saveGameState = useCallback((state: GameState) => {
    if (swRef.current?.active) {
      swRef.current.active.postMessage({
        type: 'CACHE_GAME_STATE',
        state: { ...state, timestamp: Date.now() },
      });
    }
    // Also save to localStorage as fallback
    localStorage.setItem('guts_game_state', JSON.stringify({
      ...state,
      timestamp: Date.now(),
    }));
  }, []);

  // Restore game state from cache
  const restoreGameState = useCallback(async (): Promise<GameState | null> => {
    // Try SW cache first
    if (swRef.current?.active) {
      return new Promise((resolve) => {
        const handler = (event: MessageEvent) => {
          if (event.data.type === 'GAME_STATE') {
            navigator.serviceWorker.removeEventListener('message', handler);
            resolve(event.data.state);
          }
        };
        navigator.serviceWorker.addEventListener('message', handler);
        swRef.current!.active!.postMessage({ type: 'GET_GAME_STATE' });
        
        // Timeout fallback
        setTimeout(() => {
          navigator.serviceWorker.removeEventListener('message', handler);
          const local = localStorage.getItem('guts_game_state');
          resolve(local ? JSON.parse(local) : null);
        }, 500);
      });
    }
    
    // Fallback to localStorage
    const local = localStorage.getItem('guts_game_state');
    return local ? JSON.parse(local) : null;
  }, []);

  // Clear saved game state
  const clearGameState = useCallback(() => {
    localStorage.removeItem('guts_game_state');
    // SW will auto-expire the cache entry
  }, []);

  // Queue score for background sync
  const queueScore = useCallback(async (score: OfflineScore) => {
    if (isOnline) {
      // Try to submit immediately
      try {
        const response = await fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(score),
        });
        if (response.ok) return true;
      } catch (e) {
        // Fall through to queue
      }
    }

    // Queue for background sync
    if (swRef.current?.active) {
      swRef.current.active.postMessage({
        type: 'QUEUE_SCORE',
        score,
      });
    }

    // Store in IndexedDB via SW
    // Register sync event
    if (swRef.current?.sync) {
      await swRef.current.sync.register('sync-scores');
    }

    setPendingScores((prev) => prev + 1);
    return false;
  }, [isOnline]);

  // Check for pending scores on reconnect
  useEffect(() => {
    if (isOnline && pendingScores > 0) {
      // Trigger background sync
      if (swRef.current?.sync) {
        swRef.current.sync.register('sync-scores');
      }
    }
  }, [isOnline, pendingScores]);

  return {
    isOnline,
    isPWA,
    pendingScores,
    saveGameState,
    restoreGameState,
    clearGameState,
    queueScore,
  };
}

// Hook for PWA install prompt
export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    setIsInstalled(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return false;
    
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    
    if (result.outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
      return true;
    }
    return false;
  }, [installPrompt]);

  return {
    canInstall: !!installPrompt && !isInstalled,
    isInstalled,
    install,
  };
}

// Hook for push notifications
export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    
    const result = await Notification.requestPermission();
    setPermission(result);
    
    if (result === 'granted') {
      // Subscribe to push
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      setSubscription(sub);
      
      // Send subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      
      return true;
    }
    return false;
  }, []);

  return {
    permission,
    subscription,
    requestPermission,
    isSupported: 'Notification' in window && 'PushManager' in window,
  };
}
