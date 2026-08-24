// The tab strip's wheel behaviour, as arithmetic.
//
// Kept out of the renderer so it can be checked without a window: a notch is a
// stride of about a tab, notches arriving quickly lengthen the stride, and
// pushing against an end that has run out gives instead of doing nothing.
//
// The renderer owns the animation and the DOM; everything decided here is a
// number.

/** One notch, before urgency. Roughly a tab and its gap. */
const STEP = 132
/** However fast the wheel is spun, one notch never crosses more than this. */
const STEP_MAX = 430
/** Notches closer together than this are treated as one continuous run. */
const URGENT_MS = 230
const URGENCY_MAX = 2.8
/** How far the strip may lean past an end. */
const OVERSCROLL_LIMIT = 44
/** What a single notch against a dead end adds to that lean. */
const OVERSCROLL_STEP = 17

/**
 * How much further one notch should carry the strip.
 *
 * A single click is one stride. A run of notches builds on itself, so a flick
 * crosses the strip rather than nudging it a tab at a time, and it stops
 * building at `STEP_MAX` so a violent spin cannot throw the strip end to end.
 */
function strideFor(deltaSinceLast) {
  const gap = Number(deltaSinceLast)
  const urgency = Number.isFinite(gap) && gap >= 0 && gap < URGENT_MS
    ? Math.min(URGENCY_MAX, 1 + (URGENT_MS - gap) / 150)
    : 1
  return Math.min(STEP_MAX, STEP * urgency)
}

/**
 * Where a notch takes the strip, and how far it leans if it cannot go.
 *
 * `from` is the current *target*, not the current position, so notches during
 * a glide accumulate rather than restarting it.
 *
 * @returns {{ target: number, overscroll: number, atEnd: boolean }}
 */
function wheelStep({ from, max, delta, sinceLast, overscroll = 0 }) {
  const limit = Math.max(0, Number(max) || 0)
  const start = Math.min(limit, Math.max(0, Number(from) || 0))
  const direction = Math.sign(Number(delta) || 0)
  if (!direction || limit <= 1) {
    return { target: start, overscroll: Number(overscroll) || 0, atEnd: false }
  }

  const next = start + direction * strideFor(sinceLast)
  const stuckAtStart = next < 0 && start <= 0.5
  const stuckAtEnd = next > limit && start >= limit - 0.5
  if (stuckAtStart || stuckAtEnd) {
    // Leaning the opposite way to the push, the way a surface gives under it.
    const lean = (Number(overscroll) || 0) - direction * OVERSCROLL_STEP
    return {
      target: start,
      overscroll: Math.max(-OVERSCROLL_LIMIT, Math.min(OVERSCROLL_LIMIT, lean)),
      atEnd: true,
    }
  }
  return {
    target: Math.min(limit, Math.max(0, next)),
    overscroll: Number(overscroll) || 0,
    atEnd: false,
  }
}

/**
 * The fraction of the remaining distance to cover in `elapsed` milliseconds.
 *
 * Expressed per millisecond rather than per frame so a dropped frame lengthens
 * the step instead of stalling the glide — the difference between a movement
 * and a stutter on a busy machine.
 */
function easeFraction(elapsed, perFrame) {
  const ms = Math.min(64, Math.max(0, Number(elapsed) || 0))
  return 1 - Math.pow(1 - perFrame, ms / 16.667)
}

/** How much of the lean is left after `elapsed`, and the stretch it implies. */
function relax(overscroll, elapsed, spring) {
  const ms = Math.min(64, Math.max(0, Number(elapsed) || 0))
  const next = (Number(overscroll) || 0) * Math.pow(spring, ms / 16.667)
  return Math.abs(next) < 0.4 ? 0 : next
}

/** A lean of `overscroll` pixels spreads the strip by this much. */
function stretchFor(overscroll) {
  return 1 + Math.min(0.06, Math.abs(Number(overscroll) || 0) / 900)
}

module.exports = {
  STEP, STEP_MAX, URGENT_MS, URGENCY_MAX, OVERSCROLL_LIMIT, OVERSCROLL_STEP,
  strideFor, wheelStep, easeFraction, relax, stretchFor,
}
