const test = require('node:test')
const assert = require('node:assert/strict')

const {
  STEP, STEP_MAX, URGENT_MS, OVERSCROLL_LIMIT,
  strideFor, wheelStep, easeFraction, relax, stretchFor,
} = require('../src/shared/tab-scroll')

test('one notch on its own is a stride of about a tab', () => {
  assert.equal(strideFor(2000), STEP)
  assert.equal(strideFor(URGENT_MS), STEP)
  assert.equal(strideFor(undefined), STEP, 'the first notch of a session')
})

test('notches arriving faster carry the strip further, up to a ceiling', () => {
  const slow = strideFor(200)
  const quick = strideFor(90)
  const frantic = strideFor(0)
  assert.ok(quick > slow, `${quick} should exceed ${slow}`)
  assert.ok(frantic > quick, `${frantic} should exceed ${quick}`)
  assert.ok(frantic <= STEP_MAX, 'a violent spin must not throw the strip end to end')
  assert.equal(strideFor(-5), STEP, 'a nonsensical interval falls back to one stride')
})

test('notches during a glide accumulate rather than restarting it', () => {
  const first = wheelStep({ from: 0, max: 900, delta: 1, sinceLast: 1000 })
  const second = wheelStep({ from: first.target, max: 900, delta: 1, sinceLast: 60 })
  assert.ok(second.target > first.target)
  assert.ok(second.target - first.target > first.target, 'the second notch should stride further')
})

test('a notch never leaves the scrollable range', () => {
  const past = wheelStep({ from: 800, max: 900, delta: 1, sinceLast: 1000 })
  assert.equal(past.target, 900)
  assert.equal(past.atEnd, false, 'there was still room, so this is not a dead end')
  const before = wheelStep({ from: 60, max: 900, delta: -1, sinceLast: 1000 })
  assert.equal(before.target, 0)
})

test('pushing against an end that has run out leans, and leans the other way', () => {
  const right = wheelStep({ from: 900, max: 900, delta: 1, sinceLast: 1000 })
  assert.equal(right.atEnd, true)
  assert.equal(right.target, 900, 'the strip does not move')
  assert.ok(right.overscroll < 0, 'pushing right leans left')

  const left = wheelStep({ from: 0, max: 900, delta: -1, sinceLast: 1000, overscroll: 0 })
  assert.equal(left.atEnd, true)
  assert.ok(left.overscroll > 0, 'pushing left leans right')
})

test('the lean is bounded however long it is pushed', () => {
  let lean = 0
  for (let i = 0; i < 40; i += 1) {
    lean = wheelStep({ from: 900, max: 900, delta: 1, sinceLast: 40, overscroll: lean }).overscroll
  }
  assert.ok(Math.abs(lean) <= OVERSCROLL_LIMIT, `lean ran away to ${lean}`)
})

test('a strip with nothing to scroll ignores the wheel entirely', () => {
  const still = wheelStep({ from: 0, max: 0, delta: 1, sinceLast: 20 })
  assert.deepEqual(still, { target: 0, overscroll: 0, atEnd: false })
})

test('the glide covers the same ground whether frames are quick or slow', () => {
  // Two 8ms frames must move about as far as one 16ms frame, or a busy machine
  // would scroll more slowly than an idle one.
  const one = easeFraction(16.667, 0.24)
  const half = easeFraction(8.333, 0.24)
  const twice = 1 - (1 - half) * (1 - half)
  assert.ok(Math.abs(one - twice) < 1e-4, `${one} vs ${twice}`)
  assert.ok(easeFraction(0, 0.24) === 0)
  assert.ok(easeFraction(5000, 0.24) < 1, 'a long stall must not overshoot')
})

test('the lean springs back to nothing and settles exactly', () => {
  let lean = OVERSCROLL_LIMIT
  let steps = 0
  while (lean !== 0 && steps < 200) { lean = relax(lean, 16.667, 0.82); steps += 1 }
  assert.equal(lean, 0, 'the lean never settled')
  assert.ok(steps < 40, `took ${steps} frames to settle`)
})

test('the stretch grows with the lean and stays subtle', () => {
  assert.equal(stretchFor(0), 1)
  assert.ok(stretchFor(OVERSCROLL_LIMIT) > 1)
  assert.ok(stretchFor(OVERSCROLL_LIMIT) <= 1.06, 'a stretch, not a distortion')
  assert.equal(stretchFor(-OVERSCROLL_LIMIT), stretchFor(OVERSCROLL_LIMIT), 'both ends alike')
})
