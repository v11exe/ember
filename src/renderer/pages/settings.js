// ember://settings — the few preferences Ember actually stores.

const api = window.ember?.settings

const lg = window.EmberLiquidGlass
const glass = lg ? lg.createGlass(document) : null
glass?.track()

const SESSION_OPTIONS = [
  { value: 'ask', label: 'Ask me', detail: 'Ember asks whether to reopen your tabs each time you close it.' },
  { value: 'always', label: 'Reopen tabs', detail: 'Your open tabs come back automatically next time.' },
  { value: 'never', label: 'Start fresh', detail: 'Ember always opens with a single new tab.' },
]

const SLEEP_OPTIONS = [
  { value: false, label: 'Off', detail: 'Every tab keeps its renderer for as long as it is open.' },
  { value: true, label: 'On', detail: 'Idle background tabs let go of their renderer and rebuild when you click them.' },
]

const TIMEOUT_OPTIONS = [5, 15, 30, 60, 240].map((minutes) => ({
  value: minutes,
  label: minutes < 60 ? `${minutes}m` : `${minutes / 60}h`,
}))

const FAVORITE_COLUMN_OPTIONS = [1, 2, 3, 4]
const FAVORITE_ROW_OPTIONS = [1, 2, 3, 4, 5, 6, 7]

const detail = document.getElementById('startup-detail')
const sleepDetail = document.getElementById('hibernation-detail')
let favoriteList = []
let favoriteDefaults = []
let favoriteGrid = { columns: 2, rows: 2 }

function favoriteCapacity() {
  return favoriteGrid.columns * favoriteGrid.rows
}

function favoriteProblem(value) {
  try {
    const url = new URL(value)
    if (/^https?:$/.test(url.protocol)) return ''
  } catch { /* described below */ }
  return 'Enter a complete http or https address.'
}

function showFavoriteError(message) {
  const error = document.getElementById('favorite-error')
  error.textContent = message
  error.hidden = !message
}

async function saveFavorites(next) {
  const snapshot = await api?.set('favorites', next)
  favoriteList = snapshot?.favorites || next
  renderFavorites()
}

function fillFavoriteGridSelect(select, values) {
  select.replaceChildren(...values.map((value) => {
    const option = document.createElement('option')
    option.value = String(value)
    option.textContent = String(value)
    return option
  }))
}

function renderFavoriteGrid() {
  const columns = document.getElementById('favorite-columns')
  const rows = document.getElementById('favorite-rows')
  if (!columns.options.length) fillFavoriteGridSelect(columns, FAVORITE_COLUMN_OPTIONS)
  if (!rows.options.length) fillFavoriteGridSelect(rows, FAVORITE_ROW_OPTIONS)
  columns.value = String(favoriteGrid.columns)
  rows.value = String(favoriteGrid.rows)
  document.getElementById('favorite-grid-detail').textContent = `${favoriteCapacity()} slots`
}

async function saveFavoriteGrid() {
  const next = {
    columns: Number(document.getElementById('favorite-columns').value),
    rows: Number(document.getElementById('favorite-rows').value),
  }
  const snapshot = await api?.set('favoriteGrid', next)
  favoriteGrid = snapshot?.favoriteGrid || next
  favoriteList = snapshot?.favorites || favoriteList.slice(0, favoriteCapacity())
  renderFavoriteGrid()
  renderFavorites()
}

function favoriteRow(entry, index) {
  const row = document.createElement('div')
  row.className = 'favorite-row'
  const name = document.createElement('input')
  name.className = 'favorite-name'
  name.value = entry.name
  name.setAttribute('aria-label', `Name for ${entry.name}`)
  const url = document.createElement('input')
  url.className = 'favorite-url'
  url.value = entry.url
  url.spellcheck = false
  url.setAttribute('aria-label', `Address for ${entry.name}`)

  const currentFavorite = () => ({
    ...favoriteList[index],
    name: name.value.trim() || favoriteList[index].name,
    url: url.value.trim(),
  })
  const commit = async () => {
    const edited = currentFavorite()
    const problem = favoriteProblem(edited.url)
    if (problem) { showFavoriteError(problem); renderFavorites(); return }
    showFavoriteError('')
    const next = favoriteList.map((item, itemIndex) => itemIndex === index
      ? edited
      : item)
    await saveFavorites(next)
  }
  for (const input of [name, url]) {
    input.onblur = (event) => {
      if (!row.contains(event.relatedTarget)) void commit()
    }
    input.onkeydown = (event) => {
      if (event.key === 'Enter') { event.preventDefault(); void commit() }
      if (event.key === 'Escape') { renderFavorites(); showFavoriteError('') }
    }
  }

  const move = (label, delta) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'favorite-move'
    button.textContent = label
    button.disabled = index + delta < 0 || index + delta >= favoriteList.length
    button.title = delta < 0 ? `Move ${entry.name} up` : `Move ${entry.name} down`
    button.onclick = () => {
      const next = [...favoriteList]
      const edited = currentFavorite()
      const problem = favoriteProblem(edited.url)
      if (problem) { showFavoriteError(problem); return }
      showFavoriteError('')
      next[index] = edited
      const [moved] = next.splice(index, 1)
      next.splice(index + delta, 0, moved)
      saveFavorites(next)
    }
    return button
  }

  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'favorite-remove'
  remove.textContent = '×'
  remove.title = `Remove ${entry.name}`
  remove.onclick = () => saveFavorites(favoriteList.filter((_item, itemIndex) => itemIndex !== index))
  row.append(name, url, move('↑', -1), move('↓', 1), remove)
  return row
}

function renderFavorites() {
  document.getElementById('favorite-list').replaceChildren(...favoriteList.map(favoriteRow))
  document.getElementById('favorite-count').textContent = `${favoriteList.length} of ${favoriteCapacity()} sites`
}

document.getElementById('favorite-columns').onchange = () => void saveFavoriteGrid()
document.getElementById('favorite-rows').onchange = () => void saveFavoriteGrid()

document.getElementById('favorite-new').onsubmit = (event) => {
  event.preventDefault()
  const name = document.getElementById('favorite-name')
  const url = document.getElementById('favorite-url')
  const problem = favoriteProblem(url.value.trim())
  if (problem) { showFavoriteError(problem); return }
  if (favoriteList.length >= favoriteCapacity()) { showFavoriteError(`This grid holds up to ${favoriteCapacity()} sites.`); return }
  showFavoriteError('')
  saveFavorites([...favoriteList, {
    id: `favorite-${Date.now()}`,
    name: name.value.trim() || new URL(url.value.trim()).hostname.replace(/^www\./, ''),
    url: url.value.trim(),
  }])
  name.value = url.value = ''
  name.focus()
}

document.getElementById('favorite-reset').onclick = () => {
  showFavoriteError('')
  saveFavorites(favoriteDefaults)
}

function moveThumb(thumb, active) {
  if (!thumb || !active) return
  // Measure against the first segment, not the first child: the glass mounts an
  // optical layer ahead of them, and it deliberately overhangs the control.
  const first = active.parentElement.querySelector('.segment')
  thumb.style.width = `${active.offsetWidth}px`
  thumb.style.transform = `translateX(${active.offsetLeft - (first?.offsetLeft ?? 0)}px)`
}

/**
 * One segmented radio group. `onPick` runs only when the choice actually
 * changes, so a second click on the current option is free.
 */
function renderSegmented(group, options, current, onPick) {
  if (!group) return
  const thumb = document.createElement('span')
  thumb.className = 'thumb'

  const buttons = options.map((option) => {
    const button = document.createElement('button')
    button.className = 'segment'
    button.type = 'button'
    button.role = 'radio'
    button.textContent = option.label
    button.setAttribute('aria-checked', String(option.value === current))
    button.onclick = async () => {
      if (button.getAttribute('aria-checked') === 'true') return
      for (const other of buttons) other.setAttribute('aria-checked', String(other === button))
      moveThumb(thumb, button)
      await onPick(option)
    }
    return button
  })

  group.replaceChildren(...buttons, thumb)
  const index = options.findIndex((option) => option.value === current)
  const active = buttons[index] || buttons[0]
  // Wait for layout before measuring, and skip the opening slide.
  requestAnimationFrame(() => {
    const previous = thumb.style.transition
    thumb.style.transition = 'none'
    moveThumb(thumb, active)
    requestAnimationFrame(() => { thumb.style.transition = previous })
  })
}

function renderSessionRestore(current) {
  detail.textContent = SESSION_OPTIONS.find((option) => option.value === current)?.detail || SESSION_OPTIONS[0].detail
  renderSegmented(document.getElementById('session-restore'), SESSION_OPTIONS, current, async (option) => {
    detail.textContent = option.detail
    await api?.set('sessionRestore', option.value)
  })
}

function renderNeverSleepDomains(domains) {
  const row = document.getElementById('never-sleep-row')
  const list = document.getElementById('never-sleep-domains')
  row.hidden = domains.length === 0
  list.replaceChildren(...domains.map((domain) => {
    const chip = document.createElement('span')
    chip.className = 'domain-chip'
    const label = document.createElement('span')
    label.textContent = domain
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.textContent = '×'
    remove.title = `Let ${domain} sleep again`
    remove.onclick = async () => {
      const next = await api?.set('hibernation', { neverDomains: domains.filter((entry) => entry !== domain) })
      renderNeverSleepDomains(next?.hibernation?.neverDomains || [])
    }
    chip.append(label, remove)
    return chip
  }))
}

function renderHibernation(config) {
  const settings = { enabled: true, minutes: 30, neverDomains: [], ...(config || {}) }
  const timeoutRow = document.getElementById('hibernation-timeout-row')

  const applyEnabled = (enabled) => {
    sleepDetail.textContent = SLEEP_OPTIONS.find((option) => option.value === enabled).detail
    timeoutRow.hidden = !enabled
  }
  applyEnabled(settings.enabled)

  renderSegmented(document.getElementById('hibernation-enabled'), SLEEP_OPTIONS, settings.enabled, async (option) => {
    applyEnabled(option.value)
    await api?.set('hibernation', { enabled: option.value })
  })
  renderSegmented(document.getElementById('hibernation-minutes'), TIMEOUT_OPTIONS, settings.minutes, async (option) => {
    await api?.set('hibernation', { minutes: option.value })
  })
  renderNeverSleepDomains(settings.neverDomains)
}

// ---------- selection conversions ----------
// Everything the popup needs to know about the reader: which currency, which
// units, which clock, which zone.

const CONVERSION_TOGGLE = [
  { value: true, label: 'On', detail: 'Selecting a price, a measurement or a time shows what it comes to in your units.' },
  { value: false, label: 'Off', detail: 'Ember leaves your selections alone.' },
]

const CONVERSION_GROUPS = [
  ['temperature', 'conversion-temperature', [{ value: 'c', label: '°C' }, { value: 'f', label: '°F' }]],
  ['distance', 'conversion-distance', [{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }]],
  ['weight', 'conversion-weight', [{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }]],
  ['volume', 'conversion-volume', [
    { value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'UK' }, { value: 'imperial-us', label: 'US' },
  ]],
  ['clock', 'conversion-clock', [{ value: '24', label: '24h' }, { value: '12', label: '12h' }]],
]

// The set the European Central Bank actually publishes, plus the euro itself.
const CURRENCY_CHOICES = [
  'GBP', 'EUR', 'USD', 'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK',
  'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK',
  'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'ZAR',
]

function fillSelect(select, options, current) {
  select.replaceChildren(...options.map(({ value, label }) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    option.selected = value === current
    return option
  }))
}

function timeZoneChoices() {
  let zones = []
  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch {
    zones = []
  }
  const here = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  return [{ value: 'auto', label: `Automatic (${here})` }, ...zones.map((zone) => ({ value: zone, label: zone }))]
}

function renderConversions(config) {
  const settings = {
    enabled: true, currency: 'GBP', temperature: 'c', distance: 'metric',
    weight: 'metric', volume: 'metric', clock: '24', timeZone: 'auto',
    ...(config || {}),
  }
  const detail = document.getElementById('conversion-detail')
  const rows = [...document.querySelectorAll('.conversion-row')]
  const applyEnabled = (enabled) => {
    detail.textContent = CONVERSION_TOGGLE.find((option) => option.value === enabled).detail
    for (const row of rows) row.hidden = !enabled
  }
  applyEnabled(settings.enabled)

  renderSegmented(document.getElementById('conversion-enabled'), CONVERSION_TOGGLE, settings.enabled, async (option) => {
    applyEnabled(option.value)
    await api?.set('conversions', { enabled: option.value })
  })
  for (const [key, id, options] of CONVERSION_GROUPS) {
    renderSegmented(document.getElementById(id), options, settings[key], (option) => api?.set('conversions', { [key]: option.value }))
  }

  const currency = document.getElementById('conversion-currency')
  fillSelect(currency, CURRENCY_CHOICES.map((code) => ({ value: code, label: code })), settings.currency)
  currency.onchange = () => api?.set('conversions', { currency: currency.value })

  const zone = document.getElementById('conversion-timezone')
  fillSelect(zone, timeZoneChoices(), settings.timeZone)
  zone.onchange = () => api?.set('conversions', { timeZone: zone.value })
}

// ---------- search shortcuts ----------
// The store keeps only the diff against the built-in table: additions,
// overrides and tombstones. `bangList` arrives already merged, with
// `custom: false` marking the ones that came from the defaults.
let bangDiff = []
let bangList = []
let bangDefaults = []

const ALIAS_PATTERN = /^[a-z0-9][a-z0-9_+-]{0,23}$/
const bangError = document.getElementById('bang-error')

function showBangError(message, tone = 'error') {
  bangError.textContent = message || ''
  bangError.hidden = !message
  bangError.classList.toggle('notice', tone === 'notice')
}

/** Saving over an existing keyword is allowed, but should not be silent. */
function overrideNotice(alias, previousAlias) {
  if (alias === previousAlias) return ''
  const existing = bangList.find((entry) => entry.alias === alias)
  return existing ? `${alias} now points at your address instead of ${existing.name}.` : ''
}

function validateBang(alias, url) {
  if (!ALIAS_PATTERN.test(alias)) return 'A keyword is a short word — letters, digits, - and _ only.'
  if (!url.includes('%s')) return 'The address needs %s where the search term goes.'
  if (!url.startsWith('http://') && !url.startsWith('https://')) return 'The address has to start with http:// or https://.'
  return ''
}

function isDefaultAlias(alias) {
  return bangList.some((entry) => entry.alias === alias && !entry.custom)
}

async function saveBangs(diff) {
  const settings = await api?.set('bangs', diff)
  bangDiff = settings?.bangs || []
  bangList = settings?.bangList || []
  bangDefaults = settings?.bangDefaults || bangDefaults
  renderBangs()
}

/** Replace one entry, leaving a tombstone behind if a default was renamed away. */
function upsertBang(originalAlias, entry) {
  const diff = bangDiff.filter((item) => item.alias !== originalAlias && item.alias !== entry.alias)
  if (originalAlias && originalAlias !== entry.alias && isDefaultAlias(originalAlias)) {
    diff.push({ alias: originalAlias, removed: true })
  }
  diff.push(entry)
  return saveBangs(diff)
}

function removeBang(alias) {
  const diff = bangDiff.filter((item) => item.alias !== alias)
  if (isDefaultAlias(alias)) diff.push({ alias, removed: true })
  return saveBangs(diff)
}

function bangRow(entry) {
  const row = document.createElement('div')
  row.className = 'bang-row'
  row.dataset.custom = String(!!entry.custom)

  const fields = {}
  for (const [key, value] of [['alias', entry.alias], ['name', entry.name], ['url', entry.url]]) {
    const input = document.createElement('input')
    input.className = `bang-${key}`
    input.value = value
    input.spellcheck = false
    input.setAttribute('aria-label', key === 'alias' ? 'Keyword' : key === 'name' ? 'Name' : 'Address')
    fields[key] = input
    row.append(input)
  }

  const commit = () => {
    const alias = fields.alias.value.trim().toLowerCase().replace(/^!+/, '')
    const url = fields.url.value.trim()
    const name = fields.name.value.trim() || alias
    if (alias === entry.alias && url === entry.url && name === entry.name) return
    const problem = validateBang(alias, url)
    if (problem) { showBangError(problem); renderBangs(); return }
    showBangError(overrideNotice(alias, entry.alias), 'notice')
    upsertBang(entry.alias, { alias, name, url })
  }
  for (const input of Object.values(fields)) {
    input.onblur = commit
    input.onkeydown = (event) => {
      if (event.key === 'Enter') { event.preventDefault(); input.blur() }
      if (event.key === 'Escape') { renderBangs(); showBangError('') }
    }
  }

  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'bang-remove'
  remove.textContent = '×'
  remove.title = entry.custom ? `Delete ${entry.alias}` : `Hide the built-in ${entry.alias}`
  remove.onclick = () => { showBangError(''); removeBang(entry.alias) }
  row.append(remove)
  return row
}

function renderBangs() {
  document.getElementById('bang-list').replaceChildren(...bangList.map(bangRow))

  // Editing or deleting a built-in leaves a diff behind. Without a way back,
  // deleting `yt` means retyping the YouTube URL from memory to get it again.
  const changed = bangDiff.length
  const custom = bangList.filter((entry) => entry.custom).length
  const reset = document.getElementById('bang-reset')
  reset.hidden = !changed
  reset.title = 'Undo every change to the built-in list, and remove the ones you added'
  document.getElementById('bang-count').textContent = changed
    ? `${bangList.length} shortcuts · ${custom} of your own`
    : `${bangList.length} built-in shortcuts`
}

document.getElementById('bang-reset').onclick = () => {
  showBangError('')
  // Undo only what was done to Ember's own list; keep anything of the
  // reader's own, which a blanket reset would quietly throw away.
  const builtIn = new Set(bangDefaults)
  saveBangs(bangDiff.filter((entry) => !builtIn.has(entry.alias)))
}

document.getElementById('bang-new').onsubmit = (event) => {
  event.preventDefault()
  const aliasField = document.getElementById('bang-alias')
  const nameField = document.getElementById('bang-name')
  const urlField = document.getElementById('bang-url')
  const alias = aliasField.value.trim().toLowerCase().replace(/^!+/, '')
  const url = urlField.value.trim()
  const problem = validateBang(alias, url)
  if (problem) { showBangError(problem); return }
  showBangError(overrideNotice(alias, null), 'notice')
  upsertBang(null, { alias, name: nameField.value.trim() || alias, url })
  aliasField.value = nameField.value = urlField.value = ''
  aliasField.focus()
}

for (const button of document.querySelectorAll('[data-open]')) {
  button.onclick = () => window.ember?.navigate(button.dataset.open)
}

async function load() {
  const settings = await api?.get()
  renderSessionRestore(settings?.sessionRestore || 'ask')
  renderHibernation(settings?.hibernation)
  renderConversions(settings?.conversions)
  bangDiff = settings?.bangs || []
  bangList = settings?.bangList || []
  bangDefaults = settings?.bangDefaults || []
  renderBangs()
  favoriteList = settings?.favorites || []
  favoriteDefaults = settings?.favoriteDefaults || []
  favoriteGrid = settings?.favoriteGrid || favoriteGrid
  renderFavoriteGrid()
  renderFavorites()
  document.getElementById('version').textContent = settings?.appVersion ? `Version ${settings.appVersion}` : ''
  glass?.refresh()
  // Each card is a small menu, so it gets the dropdown's sliding lens too.
  for (const card of document.querySelectorAll('.card')) {
    lg?.attachLens(card, { items: '.setting', radius: 13 })
  }
}

load()
