import { useEffect, useRef } from "react"

/**
 * Keeps a ref pointing at the latest render's value, so a mount-only effect
 * can call a fresh closure without listing it as a dependency (which would
 * re-run the effect on every render). Refs can't be written during render,
 * so the sync happens in its own effect.
 */
export const useLatest = <T>(value: T) => {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}
