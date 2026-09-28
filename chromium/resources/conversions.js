// Smart selection conversions.
//
// Selecting "$79.99" or "15 miles" or "4:30 PM PST" on a page should tell you
// what it means in your own units without a trip to a search engine. This
// module is the whole brain of that: detection and arithmetic, no UI, no
// network. Live exchange rates are handed in, so the module stays pure and
// every case is testable.
//
// Detection is deliberately conservative. A false positive puts a popup over
// the page for no reason, which is worse than missing one.

const MAX_SELECTION = 120

// ---------------------------------------------------------------- currency

const CURRENCY_SYMBOLS = new Map([
  ['US$', 'USD'], ['A$', 'AUD'], ['C$', 'CAD'], ['NZ$', 'NZD'], ['HK$', 'HKD'],
  ['R$', 'BRL'], ['S$', 'SGD'], ['NT$', 'TWD'],
  ['$', 'USD'], ['£', 'GBP'], ['€', 'EUR'], ['¥', 'JPY'], ['₹', 'INR'],
  ['₩', 'KRW'], ['₽', 'RUB'], ['₺', 'TRY'], ['₪', 'ILS'], ['₴', 'UAH'],
  ['zł', 'PLN'], ['R', 'ZAR'], ['kr', 'SEK'], ['Fr', 'CHF'],
])

const CURRENCY_CODES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY', 'INR', 'SEK',
  'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'ISK', 'ZAR', 'BRL', 'MXN',
  'SGD', 'HKD', 'KRW', 'TRY', 'ILS', 'RUB', 'THB', 'IDR', 'PHP', 'MYR', 'TWD', 'UAH',
])

/** Symbols only for the currencies people actually read at a glance. */
const CURRENCY_DISPLAY = new Map([
  ['USD', '$'], ['GBP', '£'], ['EUR', '€'], ['JPY', '¥'], ['INR', '₹'],
  ['KRW', '₩'], ['RUB', '₽'], ['TRY', '₺'], ['ILS', '₪'],
])

// Ambiguous single letters ("R", "kr", "Fr") only count with a code beside
// them, so a selected "R 20" in a maths paper stays a maths paper.
const AMBIGUOUS_SYMBOLS = new Set(['R', 'kr', 'Fr'])

// -------------------------------------------------------------------- units

/** Every unit reduced to one base per family, so conversion is one multiply. */
const UNITS = {
  length: {
    base: 'm',
    factors: {
      mm: 0.001, cm: 0.01, m: 1, km: 1000,
      in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344, nmi: 1852,
    },
    metric: ['mm', 'cm', 'm', 'km'],
    imperial: ['in', 'ft', 'mi'],
  },
  mass: {
    base: 'kg',
    factors: { g: 0.001, kg: 1, t: 1000, oz: 0.028349523125, lb: 0.45359237, st: 6.35029318 },
    metric: ['g', 'kg', 't'],
    imperial: ['oz', 'lb', 'st'],
  },
  volume: {
    base: 'l',
    factors: {
      ml: 0.001, cl: 0.01, l: 1,
      'fl oz': 0.0284130625, pt: 0.56826125, qt: 1.1365225, gal: 4.54609,
      'us fl oz': 0.0295735295625, 'us pt': 0.473176473, 'us qt': 0.946352946, 'us gal': 3.785411784,
      cup: 0.2365882365,
    },
    metric: ['ml', 'l'],
    imperial: ['fl oz', 'pt', 'gal'],
    'imperial-us': ['us fl oz', 'us pt', 'us gal'],
  },
}

/** Written forms people actually select, mapped onto a canonical unit. */
const UNIT_WORDS = new Map(Object.entries({
  // length
  mm: 'mm', millimetre: 'mm', millimetres: 'mm', millimeter: 'mm', millimeters: 'mm',
  cm: 'cm', centimetre: 'cm', centimetres: 'cm', centimeter: 'cm', centimeters: 'cm',
  m: 'm', metre: 'm', metres: 'm', meter: 'm', meters: 'm',
  km: 'km', kilometre: 'km', kilometres: 'km', kilometer: 'km', kilometers: 'km',
  in: 'in', inch: 'in', inches: 'in',
  ft: 'ft', foot: 'ft', feet: 'ft',
  yd: 'yd', yard: 'yd', yards: 'yd',
  mi: 'mi', mile: 'mi', miles: 'mi',
  nmi: 'nmi', 'nautical mile': 'nmi', 'nautical miles': 'nmi',
  // mass
  g: 'g', gram: 'g', grams: 'g', gramme: 'g', grammes: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', kilogramme: 'kg', kilogrammes: 'kg',
  t: 't', tonne: 't', tonnes: 't',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  st: 'st', stone: 'st', stones: 'st',
  // volume
  ml: 'ml', millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml',
  cl: 'cl', centilitre: 'cl', centilitres: 'cl',
  l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  'fl oz': 'fl oz', 'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
  pt: 'pt', pint: 'pt', pints: 'pt',
  qt: 'qt', quart: 'qt', quarts: 'qt',
  gal: 'gal', gallon: 'gal', gallons: 'gal',
  cup: 'cup', cups: 'cup',
}))

/** Pretty forms, so 0.5 l reads as "500 ml" and 1 lb as "1 lb" not "1 lbs". */
const UNIT_LABELS = {
  mm: 'mm', cm: 'cm', m: 'm', km: 'km', in: 'in', ft: 'ft', yd: 'yd', mi: 'mi', nmi: 'nmi',
  g: 'g', kg: 'kg', t: 't', oz: 'oz', lb: 'lb', st: 'st',
  ml: 'ml', cl: 'cl', l: 'L', 'fl oz': 'fl oz', pt: 'pt', qt: 'qt', gal: 'gal',
  'us fl oz': 'US fl oz', 'us pt': 'US pt', 'us qt': 'US qt', 'us gal': 'US gal', cup: 'cup',
}

function familyOf(unit) {
  for (const [family, spec] of Object.entries(UNITS)) {
    if (unit in spec.factors) return family
  }
  return null
}

function systemOf(family, unit) {
  const spec = UNITS[family]
  if (spec.metric.includes(unit)) return 'metric'
  if (family === 'volume' && unit.startsWith('us ')) return 'imperial-us'
  return 'imperial'
}

// -------------------------------------------------------------- time zones

/**
 * A zone abbreviation already encodes its offset, so a fixed table beats
 * guessing an IANA name. Minutes east of UTC.
 */
const ZONE_OFFSETS = new Map(Object.entries({
  UTC: 0, GMT: 0, Z: 0, WET: 0, BST: 60, IST: 60, WEST: 60,
  CET: 60, CEST: 120, EET: 120, EEST: 180, MSK: 180,
  AST: -240, EST: -300, EDT: -240, CST: -360, CDT: -300,
  MST: -420, MDT: -360, PST: -480, PDT: -420, AKST: -540, HST: -600,
  NDT: -150, ADT: -180,
  SAST: 120, GST: 240, PKT: 300, 'IST-IN': 330, BDT: 360, ICT: 420,
  SGT: 480, HKT: 480, CSTC: 480, JST: 540, KST: 540,
  AWST: 480, ACST: 570, AEST: 600, AEDT: 660, NZST: 720, NZDT: 780,
}))

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

// ------------------------------------------------------------- preferences

const CONVERSION_DEFAULTS = {
  enabled: true,
  currency: 'GBP',
  temperature: 'c',
  distance: 'metric',
  weight: 'metric',
  volume: 'metric',
  clock: '24',
  timeZone: 'auto',
}

function sanitiseConversions(value) {
  const source = value && typeof value === 'object' ? value : {}
  const oneOf = (candidate, allowed, fallback) => (allowed.includes(candidate) ? candidate : fallback)
  const currency = String(source.currency || '').toUpperCase()
  return {
    enabled: source.enabled !== false,
    currency: CURRENCY_CODES.has(currency) ? currency : CONVERSION_DEFAULTS.currency,
    temperature: oneOf(source.temperature, ['c', 'f'], CONVERSION_DEFAULTS.temperature),
    distance: oneOf(source.distance, ['metric', 'imperial'], CONVERSION_DEFAULTS.distance),
    weight: oneOf(source.weight, ['metric', 'imperial'], CONVERSION_DEFAULTS.weight),
    volume: oneOf(source.volume, ['metric', 'imperial', 'imperial-us'], CONVERSION_DEFAULTS.volume),
    clock: oneOf(String(source.clock), ['12', '24'], CONVERSION_DEFAULTS.clock),
    timeZone: typeof source.timeZone === 'string' && source.timeZone.trim()
      ? source.timeZone.trim()
      : CONVERSION_DEFAULTS.timeZone,
  }
}

// ---------------------------------------------------------------- numbers

/**
 * "1,234.5" and "1.234,5" both mean the same thing to a reader, and "1,299"
 * means one thousand two hundred, not one point two nine nine.
 */
function parseNumber(text) {
  const raw = String(text).trim().replace(/\s/g, '')
  if (!/^-?[\d.,]+$/.test(raw)) return null

  const lastComma = raw.lastIndexOf(',')
  const lastDot = raw.lastIndexOf('.')
  let normalised
  if (lastComma >= 0 && lastDot >= 0) {
    // With both present, whichever comes last is the decimal separator.
    const decimal = lastComma > lastDot ? ',' : '.'
    const group = decimal === ',' ? '.' : ','
    normalised = raw.split(group).join('').replace(decimal, '.')
  } else if (lastComma >= 0) {
    normalised = /^-?\d{1,3}(,\d{3})+$/.test(raw) ? raw.split(',').join('') : raw.replace(',', '.')
  } else {
    // A lone "1.234" is ambiguous; English reads it as a decimal.
    normalised = raw.split('.').length > 2 && /^-?\d{1,3}(\.\d{3})+$/.test(raw)
      ? raw.split('.').join('')
      : raw
  }
  const value = Number(normalised)
  return Number.isFinite(value) ? value : null
}

/** Trailing zeros read as noise, so drop them but keep money at two places. */
function formatNumber(value, { decimals = null } = {}) {
  if (!Number.isFinite(value)) return ''
  const magnitude = Math.abs(value)
  const places = decimals ?? (magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : magnitude >= 1 ? 2 : 3)
  const fixed = value.toFixed(places)
  const trimmed = places > 0 ? fixed.replace(/\.?0+$/, '') : fixed
  const [whole, fraction] = trimmed.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${grouped}.${fraction}` : grouped
}

function formatMoney(value, code) {
  const symbol = CURRENCY_DISPLAY.get(code)
  const amount = formatNumber(value, { decimals: Math.abs(value) >= 1000 ? 0 : 2 })
  return symbol ? `${symbol}${amount}` : `${amount} ${code}`
}

// --------------------------------------------------------------- detection

const UNIT_ALTERNATIVES = [...UNIT_WORDS.keys()]
  .sort((a, b) => b.length - a.length)
  .map((word) => word.replace(/ /g, '\\s'))
  .join('|')

const NUMBER = String.raw`-?\d[\d,. ]*\d|-?\d`
const CURRENCY_SYMBOL_ALTERNATIVES = [...CURRENCY_SYMBOLS.keys()]
  .sort((a, b) => b.length - a.length)
  .map((symbol) => symbol.replace(/[$^.*+?()[\]{}|\\]/g, '\\$&'))
  .join('|')

const PATTERNS = {
  currencySymbol: new RegExp(String.raw`^(${CURRENCY_SYMBOL_ALTERNATIVES})\s?(${NUMBER})$`, 'i'),
  currencyCode: new RegExp(String.raw`^(${NUMBER})\s?([a-z]{3})$`, 'i'),
  currencyCodeFirst: new RegExp(String.raw`^([a-z]{3})\s?(${NUMBER})$`, 'i'),
  temperature: new RegExp(String.raw`^(${NUMBER})\s?(?:°\s?([cfk])|degrees?\s+(celsius|centigrade|fahrenheit|kelvin)|°)$`, 'i'),
  measurement: new RegExp(String.raw`^(${NUMBER})\s?(${UNIT_ALTERNATIVES})$`, 'i'),
  // 5 ft 11, 5'11", 6' 2
  feetInches: /^(\d{1,2})\s*(?:'|ft|feet|foot)\s*(\d{1,2}(?:\.\d+)?)?\s*(?:"|''|in|inch|inches)?$/i,
  // 12 st 4 lb
  stonePounds: /^(\d{1,2})\s*(?:st|stone|stones)\s*(\d{1,2}(?:\.\d+)?)?\s*(?:lb|lbs|pounds?)?$/i,
  clock: /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+([a-z]{2,5})$/i,
  dateTime: new RegExp(String.raw`^(?:(${MONTHS.join('|')})\s+(\d{1,2})|(\d{1,2})\s+(${MONTHS.join('|')}))(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\s*(?:,|at|@)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*([a-z]{2,5})?$`, 'i'),
}

function temperatureUnit(symbol, word) {
  if (symbol) return symbol.toUpperCase()
  const name = String(word || '').toLowerCase()
  if (name.startsWith('fahren')) return 'F'
  if (name.startsWith('kelvin')) return 'K'
  return 'C'
}

function zoneOffset(abbreviation) {
  if (!abbreviation) return null
  const key = String(abbreviation).toUpperCase()
  return ZONE_OFFSETS.has(key) ? ZONE_OFFSETS.get(key) : null
}

/**
 * What, if anything, the selected text is.
 *
 * @param {string} text
 * @returns {object|null} a descriptor the convert() step understands
 */
function detectValue(text) {
  const raw = String(text || '').trim().replace(/\s+/g, ' ')
  if (!raw || raw.length > MAX_SELECTION) return null

  // Compound imperial reads before the plain number+unit pattern, because
  // "5 ft 11" is one height rather than two measurements.
  const feet = PATTERNS.feetInches.exec(raw)
  if (feet && (feet[2] !== undefined || /['"]|ft|feet|foot/i.test(raw))) {
    const inches = Number(feet[1]) * 12 + Number(feet[2] || 0)
    return { kind: 'measurement', family: 'length', unit: 'in', value: inches, text: raw, compound: 'feet-inches' }
  }
  const stone = PATTERNS.stonePounds.exec(raw)
  if (stone && stone[2] !== undefined) {
    const pounds = Number(stone[1]) * 14 + Number(stone[2])
    return { kind: 'measurement', family: 'mass', unit: 'lb', value: pounds, text: raw, compound: 'stone-pounds' }
  }

  const symbolMoney = PATTERNS.currencySymbol.exec(raw)
  if (symbolMoney) {
    const symbol = symbolMoney[1]
    const code = CURRENCY_SYMBOLS.get(symbol) || CURRENCY_SYMBOLS.get(symbol.toUpperCase())
    const value = parseNumber(symbolMoney[2])
    if (code && value !== null && !AMBIGUOUS_SYMBOLS.has(symbol)) {
      return { kind: 'currency', code, value, text: raw }
    }
  }

  for (const [pattern, order] of [[PATTERNS.currencyCode, 'value-first'], [PATTERNS.currencyCodeFirst, 'code-first']]) {
    const match = pattern.exec(raw)
    if (!match) continue
    const code = String(order === 'value-first' ? match[2] : match[1]).toUpperCase()
    const value = parseNumber(order === 'value-first' ? match[1] : match[2])
    if (CURRENCY_CODES.has(code) && value !== null) return { kind: 'currency', code, value, text: raw }
  }

  const temperature = PATTERNS.temperature.exec(raw)
  if (temperature) {
    const value = parseNumber(temperature[1])
    // A bare degree sign means whichever scale the reader does not use.
    const unit = temperature[2] || temperature[3] ? temperatureUnit(temperature[2], temperature[3]) : null
    if (value !== null) return { kind: 'temperature', unit, value, text: raw }
  }

  const measurement = PATTERNS.measurement.exec(raw)
  if (measurement) {
    const word = measurement[2].toLowerCase().replace(/\s+/g, ' ')
    const unit = UNIT_WORDS.get(word)
    const value = parseNumber(measurement[1])
    const family = unit && familyOf(unit)
    // A bare "m" or "t" beside a number is more often a variable or a count
    // of minutes than a metre, so those two need spelling out.
    if (unit && family && value !== null && !(word === 'm' || word === 't')) {
      return { kind: 'measurement', family, unit, value, text: raw }
    }
  }

  const dateTime = PATTERNS.dateTime.exec(raw)
  if (dateTime) {
    const monthName = (dateTime[1] || dateTime[4] || '').toLowerCase()
    const day = Number(dateTime[2] || dateTime[3])
    const offset = zoneOffset(dateTime[9])
    if (monthName && day >= 1 && day <= 31 && offset !== null) {
      return {
        kind: 'datetime',
        month: MONTHS.indexOf(monthName),
        day,
        year: dateTime[5] ? Number(dateTime[5]) : null,
        hour: Number(dateTime[6]),
        minute: Number(dateTime[7] || 0),
        meridiem: dateTime[8] ? dateTime[8].toLowerCase() : null,
        zone: dateTime[9].toUpperCase(),
        offset,
        text: raw,
      }
    }
  }

  const clock = PATTERNS.clock.exec(raw)
  if (clock) {
    const offset = zoneOffset(clock[4])
    const hour = Number(clock[1])
    if (offset !== null && hour <= 23 && (clock[2] !== undefined || clock[3])) {
      return {
        kind: 'time',
        hour,
        minute: Number(clock[2] || 0),
        meridiem: clock[3] ? clock[3].toLowerCase() : null,
        zone: clock[4].toUpperCase(),
        offset,
        text: raw,
      }
    }
  }

  return null
}

// -------------------------------------------------------------- conversion

/** Pick the rung of the target ladder that reads best for this magnitude. */
function pickUnit(family, system, baseValue) {
  const spec = UNITS[family]
  const ladder = spec[system] || spec.metric
  let chosen = ladder[0]
  for (const unit of ladder) {
    if (Math.abs(baseValue) / spec.factors[unit] >= 1) chosen = unit
  }
  return chosen
}

function convertMeasurement(detected, prefs) {
  const spec = UNITS[detected.family]
  const target = { length: prefs.distance, mass: prefs.weight, volume: prefs.volume }[detected.family]
  const sourceSystem = systemOf(detected.family, detected.unit)
  // Converting metric to metric tells the reader nothing they did not select.
  if (sourceSystem === target && !detected.compound) return null

  const baseValue = detected.value * spec.factors[detected.unit]
  const unit = pickUnit(detected.family, target, baseValue)
  const value = baseValue / spec.factors[unit]
  return {
    from: `${formatNumber(detected.value)} ${UNIT_LABELS[detected.unit]}`,
    to: `${formatNumber(value)} ${UNIT_LABELS[unit]}`,
    approximate: true,
  }
}

function convertTemperature(detected, prefs) {
  const target = prefs.temperature === 'f' ? 'F' : 'C'
  const unit = detected.unit || (target === 'C' ? 'F' : 'C')
  if (unit === target) return null
  const celsius = unit === 'C' ? detected.value : unit === 'K' ? detected.value - 273.15 : (detected.value - 32) * 5 / 9
  const value = target === 'C' ? celsius : celsius * 9 / 5 + 32
  return {
    from: `${formatNumber(detected.value)}°${unit}`,
    to: `${formatNumber(value, { decimals: 1 })}°${target}`,
    approximate: true,
  }
}

function convertCurrency(detected, prefs, rates) {
  const target = prefs.currency
  if (!rates?.rates || detected.code === target) return null
  const table = { ...rates.rates, [rates.base]: 1 }
  const from = table[detected.code]
  const to = table[target]
  if (!from || !to) return null
  return {
    from: formatMoney(detected.value, detected.code),
    to: formatMoney(detected.value * (to / from), target),
    approximate: true,
    note: rates.date ? `Rates ${rates.date}` : '',
  }
}

/** Minutes east of UTC for an IANA zone at a given instant. */
function zoneOffsetAt(timeZone, date) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone, hour12: false, timeZoneName: 'longOffset',
    }).formatToParts(date)
    const name = parts.find((part) => part.type === 'timeZoneName')?.value || ''
    const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name)
    if (!match) return 0
    const sign = match[1] === '-' ? -1 : 1
    return sign * (Number(match[2]) * 60 + Number(match[3] || 0))
  } catch {
    return null
  }
}

function localZone(prefs) {
  if (prefs.timeZone && prefs.timeZone !== 'auto') return prefs.timeZone
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function hour24(hour, meridiem) {
  if (!meridiem) return hour
  if (meridiem === 'pm') return hour === 12 ? 12 : hour + 12
  return hour === 12 ? 0 : hour
}

function formatClock(date, timeZone, clock) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hour12: clock === '12',
  }).format(date).replace(/\s?(am|pm)/i, (match) => match.toUpperCase())
}

function formatDay(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone, weekday: 'long', day: 'numeric', month: 'long',
  }).format(date)
}

function zoneLabel(timeZone, date) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'short' }).formatToParts(date)
    return parts.find((part) => part.type === 'timeZoneName')?.value || ''
  } catch {
    return ''
  }
}

function convertTime(detected, prefs, now) {
  const zone = localZone(prefs)
  const reference = now instanceof Date ? now : new Date(now || Date.now())
  const hour = hour24(detected.hour, detected.meridiem)

  // Build the instant from the selected wall clock plus its stated offset.
  const base = detected.kind === 'datetime'
    ? Date.UTC(detected.year ?? reference.getUTCFullYear(), detected.month, detected.day, hour, detected.minute)
    : Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), hour, detected.minute)
  const instant = new Date(base - detected.offset * 60_000)
  if (Number.isNaN(instant.getTime())) return null

  const localOffset = zoneOffsetAt(zone, instant)
  if (localOffset === null) return null
  if (localOffset === detected.offset) return null // already local, nothing to say

  return {
    // The selected text is already the clearest statement of the source.
    from: detected.text,
    to: `${formatClock(instant, zone, prefs.clock)} ${zoneLabel(zone, instant)}`.trim(),
    note: formatDay(instant, zone),
    approximate: false,
  }
}

/**
 * Turn a detection into the two or three lines the popup shows.
 *
 * @param {object} detected  from detectValue()
 * @param {object} prefs     sanitised conversion preferences
 * @param {{ rates?: object, now?: Date }} [context]
 * @returns {{ from: string, to: string, note?: string, kind: string }|null}
 */
function convert(detected, prefs = CONVERSION_DEFAULTS, context = {}) {
  if (!detected) return null
  const settings = sanitiseConversions(prefs)
  let result = null
  if (detected.kind === 'currency') result = convertCurrency(detected, settings, context.rates)
  else if (detected.kind === 'temperature') result = convertTemperature(detected, settings)
  else if (detected.kind === 'measurement') result = convertMeasurement(detected, settings)
  else if (detected.kind === 'time' || detected.kind === 'datetime') result = convertTime(detected, settings, context.now)
  if (!result) return null
  return { kind: detected.kind, ...result }
}

/** One call for the main process: text in, popup payload or null out. */
function describeSelection(text, prefs, context) {
  return convert(detectValue(text), prefs, context)
}

module.exports = {
  MAX_SELECTION,
  CONVERSION_DEFAULTS,
  CURRENCY_CODES,
  CURRENCY_DISPLAY,
  UNITS,
  UNIT_LABELS,
  ZONE_OFFSETS,
  sanitiseConversions,
  parseNumber,
  formatNumber,
  formatMoney,
  detectValue,
  convert,
  describeSelection,
  zoneOffsetAt,
  localZone,
}
