// Toasts that have to survive a full page load. While the React app (frontend-react/) serves
// some pages, a link to one of them loads it from the server (see app.js), and a toast shown
// right before that ("Event is deleted.") would be lost. So the toasts of the last moments are
// handed over through sessionStorage, and whichever app loads next shows them.
// The React app uses the same key and format (frontend-react/src/lib/flash.ts).
const KEY = 'myaegee:flash'
const HAND_OVER_MS = 2000
const recent = []

export function remember (notification) {
  recent.push({ message: notification.message, type: notification.type, at: Date.now() })
  if (recent.length > 10) recent.shift()
}

export function handOver () {
  const now = Date.now()
  const pending = recent
    .filter(notification => now - notification.at < HAND_OVER_MS)
    .map(({ message, type }) => ({ message, type }))
  if (pending.length === 0) return

  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(pending))
  } catch (err) {
    // Storage can be unavailable (private mode); the toast is then lost, nothing worse.
  }
}

export function takeOver () {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    window.sessionStorage.removeItem(KEY)
    const pending = raw ? JSON.parse(raw) : []
    return Array.isArray(pending) ? pending.filter(n => n && typeof n.message === 'string') : []
  } catch (err) {
    return []
  }
}
