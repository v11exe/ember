const test = require('node:test')
const assert = require('node:assert/strict')

const {
  CONVERSION_DEFAULTS, sanitiseConversions, parseNumber, formatNumber,
  detectValue, convert, describeSelection,
} = require('../src/shared/conversions')

// ECB-shaped table, the same shape the rate cache hands over.
const RATES = {
  base: 'EUR',
  date: '2026-08-21',
  rates: { USD: 1.1, GBP: 0.85, JPY: 170, CHF: 0.95 },
}

const UK = { ...CONVERSION_DEFAULTS, currency: 'GBP', timeZone: 'Europe/London' }
const US = {
  ...CONVERSION_DEFAULTS,
  currency: 'USD', temperature: 'f', distance: 'imperial', weight: 'imperial',
  volume: 'imperial-us', clock: '12', timeZone: 'America/New_York',
}

// ---- numbers ----

test('numbers parse in both decimal conventions', () => {
  assert.equal(parseNumber('79.99'), 79.99)
  assert.equal(parseNumber('1,234.5'), 1234.5)
  assert.equal(parseNumber('1.234,5'), 1234.5)
  assert.equal(parseNumber('1 234'), 1234)
  assert.equal(parseNumber('nonsense'), null)
})

test('numbers format without trailing noise', () => {
  assert.equal(formatNumber(24.14016), '24.1')
  assert.equal(formatNumber(1609.344), '1,609')
  assert.equal(formatNumber(2), '2')
  assert.equal(formatNumber(0.5), '0.5')
})

// ---- detection ----

test('currency is detected from symbols and codes', () => {
  assert.deepEqual(detectValue('$79.99'), { kind: 'currency', code: 'USD', value: 79.99, text: '$79.99' })
  assert.equal(detectValue('€120').code, 'EUR')
  assert.equal(detectValue('£1,299').value, 1299)
  assert.equal(detectValue('120 EUR').code, 'EUR')
  assert.equal(detectValue('USD 45').code, 'USD')
  assert.equal(detectValue('A$60').code, 'AUD')
})

test('ambiguous currency letters are ignored', () => {
  assert.equal(detectValue('R 20'), null)
  assert.equal(detectValue('kr 90'), null)
})

test('measurements are detected from their written forms', () => {
  assert.deepEqual(detectValue('15 miles'),
    { kind: 'measurement', family: 'length', unit: 'mi', value: 15, text: '15 miles' })
  assert.equal(detectValue('10 lb').unit, 'lb')
  assert.equal(detectValue('250 ml').unit, 'ml')
  assert.equal(detectValue('3 kilometres').unit, 'km')
  assert.equal(detectValue('16 fl oz').unit, 'fl oz')
})

test('compound imperial reads as one value', () => {
  const height = detectValue('5 ft 11')
  assert.equal(height.family, 'length')
  assert.equal(height.unit, 'in')
  assert.equal(height.value, 71)
  assert.equal(detectValue(`6'2"`).value, 74)
  const weight = detectValue('12 st 4')
  assert.equal(weight.unit, 'lb')
  assert.equal(weight.value, 172)
})

test('temperature is detected with or without a scale', () => {
  assert.deepEqual(detectValue('32°F'), { kind: 'temperature', unit: 'F', value: 32, text: '32°F' })
  assert.equal(detectValue('100 °C').unit, 'C')
  assert.equal(detectValue('20 degrees celsius').unit, 'C')
  assert.equal(detectValue('180°').unit, null, 'a bare degree leaves the scale open')
})

test('clock times need a recognised zone', () => {
  const time = detectValue('4:30 PM PST')
  assert.equal(time.kind, 'time')
  assert.equal(time.hour, 4)
  assert.equal(time.minute, 30)
  assert.equal(time.meridiem, 'pm')
  assert.equal(time.offset, -480)
  assert.equal(detectValue('16:30 CET').offset, 60)
  assert.equal(detectValue('4:30 PM XYZ'), null)
  assert.equal(detectValue('chapter 5 of'), null)
  assert.equal(detectValue('12 monkeys'), null)
})

test('dates with a time and zone are detected in both orders', () => {
  const later = detectValue('August 24 at 8 PM EST')
  assert.equal(later.kind, 'datetime')
  assert.equal(later.month, 7)
  assert.equal(later.day, 24)
  assert.equal(later.hour, 8)
  assert.equal(later.meridiem, 'pm')
  assert.equal(later.offset, -300)
  assert.equal(detectValue('24 August 2026, 20:00 CEST').day, 24)
})

test('ordinary prose is not a value', () => {
  for (const text of ['hello world', '', '   ', 'the quick brown fox', 'x'.repeat(200), '2026']) {
    assert.equal(detectValue(text), null, `${text} should not be detected`)
  }
})

// ---- conversion ----

test('currency converts through the rate table', () => {
  const result = convert(detectValue('$79.99'), UK, { rates: RATES })
  assert.equal(result.kind, 'currency')
  assert.equal(result.from, '$79.99')
  // 79.99 USD -> EUR -> GBP at 0.85/1.1
  assert.equal(result.to, '£61.81')
  assert.match(result.note, /2026-08-21/)
})

test('currency in the preferred currency says nothing', () => {
  assert.equal(convert(detectValue('£50'), UK, { rates: RATES }), null)
  assert.equal(convert(detectValue('$50'), UK, { rates: null }), null, 'no rates, no answer')
  assert.equal(convert(detectValue('$50'), { ...UK, currency: 'THB' }, { rates: RATES }), null,
    'a currency the table does not carry')
})

test('distance converts into the preferred system and rung', () => {
  assert.equal(convert(detectValue('15 miles'), UK).to, '24.1 km')
  assert.equal(convert(detectValue('12 in'), UK).to, '30.5 cm')
  assert.equal(convert(detectValue('10 km'), US).to, '6.21 mi')
  assert.equal(convert(detectValue('10 km'), UK), null, 'metric to metric is not a conversion')
})

test('a compound height still converts even though it is already imperial', () => {
  assert.equal(convert(detectValue('5 ft 11'), UK).to, '1.8 m')
})

test('weight and volume follow their own preference', () => {
  assert.equal(convert(detectValue('10 lb'), UK).to, '4.54 kg')
  assert.equal(convert(detectValue('250 ml'), US).to, '8.45 US fl oz')
  assert.equal(convert(detectValue('2 pints'), UK).to, '1.14 L')
  assert.equal(convert(detectValue('2 pints'), { ...UK, volume: 'imperial' }), null,
    'pints are already what an imperial reader wanted')
})

test('temperature converts both ways, and a bare degree picks the other scale', () => {
  assert.equal(convert(detectValue('32°F'), UK).to, '0°C')
  assert.equal(convert(detectValue('100°C'), US).to, '212°F')
  assert.equal(convert(detectValue('180°'), UK).to, '82.2°C')
  assert.equal(convert(detectValue('20°C'), UK), null)
})

test('a clock time converts into the reader own zone', () => {
  // 4:30 PM PDT on 23 August is 00:30 the next day in London.
  const result = convert(detectValue('4:30 PM PDT'), UK, { now: new Date('2026-08-23T12:00:00Z') })
  assert.equal(result.kind, 'time')
  assert.equal(result.from, '4:30 PM PDT')
  assert.equal(result.to, '00:30 BST')
  assert.equal(result.note, 'Monday 24 August')
})

test('a dated time keeps its own date', () => {
  const result = convert(detectValue('August 24 at 8 PM EST'), UK, { now: new Date('2026-08-23T12:00:00Z') })
  // 8 PM EST is 01:00 UTC the next day, which London reads as 02:00 BST.
  assert.equal(result.to, '02:00 BST')
  assert.equal(result.note, 'Tuesday 25 August')
})

test('a twelve hour reader gets a twelve hour answer', () => {
  const result = convert(detectValue('16:30 CET'), US, { now: new Date('2026-08-23T12:00:00Z') })
  // 16:30 CET is 15:30 UTC, and New York is four hours behind in August.
  assert.equal(result.to, '11:30 AM GMT-4')
})

test('a time already in the reader zone says nothing', () => {
  assert.equal(convert(detectValue('4:30 PM BST'), UK, { now: new Date('2026-08-23T12:00:00Z') }), null)
})

test('describeSelection is detection and conversion in one call', () => {
  assert.equal(describeSelection('15 miles', UK).to, '24.1 km')
  assert.equal(describeSelection('hello', UK), null)
})

// ---- preferences ----

test('preferences are sanitised to known values', () => {
  assert.deepEqual(sanitiseConversions(undefined), CONVERSION_DEFAULTS)
  assert.equal(sanitiseConversions({ currency: 'gbp' }).currency, 'GBP')
  assert.equal(sanitiseConversions({ currency: 'XXX' }).currency, 'GBP')
  assert.equal(sanitiseConversions({ temperature: 'kelvin' }).temperature, 'c')
  assert.equal(sanitiseConversions({ clock: 12 }).clock, '12')
  assert.equal(sanitiseConversions({ enabled: false }).enabled, false)
  assert.equal(sanitiseConversions({ timeZone: '  Europe/Berlin ' }).timeZone, 'Europe/Berlin')
  assert.equal(sanitiseConversions({ timeZone: '' }).timeZone, 'auto')
})
