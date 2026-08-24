// ember://history — renders the visit log grouped by day, Opera One style.
// All data comes from the main process via window.ember.history (page-preload).

const els = {
  results: document.getElementById('results'),
  search: document.getElementById('search'),
  clearSearch: document.getElementById('clear-search'),
  sideNav: document.getElementById('side-nav'),
  dateInput: document.getElementById('date-input'),
  dateLabel: document.getElementById('date-label'),
  deleteData: document.getElementById('delete-data'),
  fullView: document.getElementById('full-view'),
  dateFilter: document.getElementById('date-filter'),
}

const api = window.ember?.history

// One material for every surface: the new tab search glass, elasticity removed.
// Cards are rebuilt on each render, so re-mount after.
const lg = window.EmberLiquidGlass
const glass = lg ? lg.createGlass(document) : null
glass?.track()
let snapshot = { entries: [], recentlyClosed: [] }
let query = ''
let dayFilter = null
let showAllClosed = false
const selected = new Set()

const DAY = 86_400_000
// "Recently" closed means the last five minutes. Showing one entry meant the
// tab you actually wanted was usually the one hidden.
const RECENTLY_CLOSED_WINDOW = 5 * 60_000
const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const heading = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

const startOfDay = (value) => { const d = new Date(value); d.setHours(0, 0, 0, 0); return d.getTime() }

function dayLabel(dayStart) {
  const today = startOfDay(Date.now())
  const prefix = dayStart === today ? 'Today' : dayStart === today - DAY ? 'Yesterday' : null
  const full = heading.format(new Date(dayStart))
  return prefix ? `${prefix} - ${full}` : full
}

function matches(entry) {
  if (dayFilter !== null && startOfDay(entry.visitedAt) !== dayFilter) return false
  if (!query) return true
  const needle = query.toLowerCase()
  return entry.title.toLowerCase().includes(needle) || entry.url.toLowerCase().includes(needle)
}

function groupByDay(entries) {
  const groups = new Map()
  for (const entry of entries) {
    const key = startOfDay(entry.visitedAt)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(entry)
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0])
}

function favicon(entry) {
  if (entry.favicon) {
    const img = document.createElement('img')
    img.className = 'favicon'
    img.src = entry.favicon
    img.alt = ''
    img.onerror = () => img.replaceWith(faviconFallback(entry))
    return img
  }
  return faviconFallback(entry)
}

function faviconFallback(entry) {
  const span = document.createElement('div')
  span.className = 'favicon-fallback'
  span.textContent = (entry.host || entry.title || '?').replace(/^www\./, '').charAt(0).toUpperCase()
  return span
}

function row(entry, { stamp = entry.visitedAt, reopen = false } = {}) {
  const el = document.createElement('div')
  el.className = 'row' + (selected.has(entry.id) ? ' selected' : '')
  el.title = entry.url

  const box = document.createElement('input')
  box.type = 'checkbox'
  box.checked = selected.has(entry.id)
  box.setAttribute('aria-label', `Select ${entry.title}`)
  box.onclick = (event) => {
    event.stopPropagation()
    box.checked ? selected.add(entry.id) : selected.delete(entry.id)
    el.classList.toggle('selected', box.checked)
    renderDeleteButton()
  }

  const when = document.createElement('span')
  when.className = 'time'
  when.textContent = time.format(new Date(stamp))

  const host = document.createElement('span')
  host.className = 'host'
  host.textContent = entry.host || entry.url

  const title = document.createElement('span')
  title.className = 'title'
  title.textContent = entry.title

  el.append(box, when, favicon(entry), host, title)
  if (reopen) {
    const again = document.createElement('button')
    again.className = 'reopen'
    again.type = 'button'
    again.textContent = 'Reopen'
    again.title = `Reopen ${entry.title}`
    again.onclick = (event) => { event.stopPropagation(); api?.open(entry.url) }
    el.append(again)
  }
  el.onclick = () => api?.open(entry.url)
  return el
}

function card(title, rows, extra, section = null) {
  const el = document.createElement('section')
  el.className = 'card'
  el.dataset.lg = ''
  if (section) el.dataset.section = section

  const head = document.createElement('div')
  head.className = 'card-head'
  const label = document.createElement('span')
  label.textContent = title
  head.append(label)
  if (extra) head.append(extra)

  el.append(head, ...rows)
  // The dropdown menu's hover: one lens sliding between rows, not a fill.
  lg?.attachLens(el, { items: '.row', radius: 13 })
  return el
}

function renderDeleteButton() {
  lg?.setLabel(els.deleteData, selected.size
    ? `Delete ${selected.size} selected`
    : 'Delete browsing data…')
}

function render() {
  const visible = snapshot.entries.filter(matches)
  const sections = []

  if (!query && dayFilter === null && snapshot.recentlyClosed.length) {
    const cutoff = Date.now() - RECENTLY_CLOSED_WINDOW
    const recent = snapshot.recentlyClosed.filter((item) => item.closedAt >= cutoff)
    // Nothing in the window yet: the most recent one is still the useful
    // answer, so the section never goes empty just because five minutes passed.
    const within = recent.length ? recent : snapshot.recentlyClosed.slice(0, 1)
    const closed = showAllClosed ? snapshot.recentlyClosed : within
    const more = document.createElement('button')
    more.className = 'more'
    more.textContent = showAllClosed ? 'Show less' : 'Show more'
    more.onclick = (event) => { event.stopPropagation(); showAllClosed = !showAllClosed; render() }
    sections.push(card(
      'Recently closed',
      closed.map((item) => row(item, { stamp: item.closedAt, reopen: true })),
      snapshot.recentlyClosed.length > closed.length || showAllClosed ? more : null,
      'closed',
    ))
  }

  const today = startOfDay(Date.now())
  let taggedOlder = false
  for (const [day, entries] of groupByDay(visible)) {
    let section = null
    if (day === today) section = 'today'
    else if (day === today - DAY) section = 'yesterday'
    else if (!taggedOlder) { section = 'older'; taggedOlder = true }
    sections.push(card(dayLabel(day), entries.map((entry) => row(entry)), null, section))
  }

  if (!sections.length) {
    const empty = document.createElement('div')
    empty.className = 'empty card'
    empty.dataset.lg = ''
    const strong = document.createElement('strong')
    strong.textContent = query || dayFilter !== null ? 'Nothing matches' : 'No history yet'
    empty.append(strong, document.createTextNode(
      query || dayFilter !== null
        ? 'Try a different search or clear the date filter.'
        : 'Pages you visit will be listed here.',
    ))
    sections.push(empty)
  }

  els.results.replaceChildren(...sections)
  glass?.refresh()
  renderSideNav(visible)
  renderDeleteButton()
}

function renderSideNav(visible) {
  const today = startOfDay(Date.now())
  const counts = { today: 0, yesterday: 0, older: 0 }
  for (const entry of snapshot.entries) {
    const day = startOfDay(entry.visitedAt)
    if (day === today) counts.today++
    else if (day === today - DAY) counts.yesterday++
    else counts.older++
  }

  const links = [
    { id: 'closed', label: 'Recently closed', enabled: snapshot.recentlyClosed.length > 0 },
    { id: 'today', label: 'Today', enabled: counts.today > 0 },
    { id: 'yesterday', label: 'Yesterday', enabled: counts.yesterday > 0 },
    { id: 'older', label: 'Older', enabled: counts.older > 0 },
  ]

  els.sideNav.replaceChildren(...links.map(({ id, label, enabled }) => {
    const button = document.createElement('button')
    button.className = 'side-link'
    button.disabled = !enabled
    const dot = document.createElement('span')
    dot.className = 'dot'
    const text = document.createElement('span')
    text.textContent = label
    button.append(dot, text)
    button.onclick = () => jumpTo(id)
    return button
  }))
  lg?.attachLens(els.sideNav, { items: '.side-link', radius: 10 })
  void visible
}

/**
 * Go to a section of the list.
 *
 * These used to narrow the list to that day instead, which is why pressing
 * Older and then Today landed somewhere arbitrary: the page it scrolled was
 * not the page it had just rebuilt. Nothing is filtered now — the whole list
 * stays put and the view travels to the heading, which is what "navigate to"
 * says it does.
 */
function jumpTo(id) {
  if (dayFilter !== null) { dayFilter = null; setDateLabel(null); render() }
  const target = els.results.querySelector(`[data-section="${id}"]`)
  if (!target) return
  const top = target.offsetTop - els.results.offsetTop
  els.results.scrollTo({
    top: Math.max(0, top),
    behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
  })
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

function setDateLabel(day) {
  els.dateLabel.textContent = day === null ? 'Pick the date' : heading.format(new Date(day))
  els.dateInput.value = day === null ? '' : new Date(day - new Date(day).getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 10)
}

// ---------- input ----------
els.search.addEventListener('input', () => {
  query = els.search.value.trim()
  els.clearSearch.hidden = !query
  render()
})
els.clearSearch.onclick = () => {
  els.search.value = ''
  query = ''
  els.clearSearch.hidden = true
  els.search.focus()
  render()
}
els.dateInput.addEventListener('change', () => {
  dayFilter = els.dateInput.value ? startOfDay(`${els.dateInput.value}T00:00:00`) : null
  setDateLabel(dayFilter)
  render()
})
els.deleteData.onclick = async () => {
  if (!api) return
  snapshot = selected.size ? await api.remove([...selected]) : await api.clear({})
  selected.clear()
  render()
}
els.fullView.onclick = () => window.scrollTo({ top: 0 })
const openDatePicker = (event) => {
  // The input is a transparent overlay, and Chromium does not open a date
  // picker from a click on one — only from the calendar indicator it hides, or
  // from an explicit request like this. Without it the control did nothing.
  event?.preventDefault()
  try { els.dateInput.showPicker() } catch { els.dateInput.focus() }
}
els.dateFilter.onclick = openDatePicker
document.querySelector('.side-item')?.addEventListener('click', openDatePicker)

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && query) { els.clearSearch.click(); return }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault()
    els.search.focus()
    els.search.select()
  }
})

async function load() {
  snapshot = (await api?.query()) || { entries: [], recentlyClosed: [] }
  render()
}

load()

// B26: back to the new tab page. These pages open as ordinary tabs, so without
// this the only way out is the omnibox or the tab strip.
document.getElementById('back-home')?.addEventListener('click', () => {
  if (window.ember?.navigate) window.ember.navigate('ember://newtab')
  else location.href = 'ember://newtab'
})
