export const WELCOME_SPLASH_STORAGE_KEY = 'bikrikoro:welcome-splash-seen-v1'
export const WELCOME_SPLASH_REPLAY_EVENT = 'bikrikoro-replay-welcome-splash'

export function replayWelcomeSplash() {
  try { window.localStorage.removeItem(WELCOME_SPLASH_STORAGE_KEY) } catch { /* private browsing may block storage */ }
  window.dispatchEvent(new Event(WELCOME_SPLASH_REPLAY_EVENT))
}
