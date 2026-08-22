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

// Real refraction on every glass surface, using the same displacement machinery
// the overlays use. Cards are rebuilt on each render, so re-apply after.
const glass = window.EmberPageGlass && window.EmberUploadOptics
  ? window.EmberPageGlass.createPageGlass(document, window.EmberUploadOptics, { selector: '[data-glass]' })
  : null
let snapshot = { entries: [], recentlyClosed: [] }
let query = ''
let dayFilter = null
let showAllClosed = false
const selected = new Set()

const DAY = 86_400_000
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

function row(entry, { stamp = entry.visitedAt } = {}) {
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
  el.onclick = () => api?.open(entry.url)
  return el
}

function card(title, rows, extra) {
  const el = document.createElement('section')
  el.className = 'card glass'
  el.dataset.glass = ''

  const head = document.createElement('div')
  head.className = 'card-head'
  const label = document.createElement('span')
  label.textContent = title
  head.append(label)
  if (extra) head.append(extra)

  el.append(head, ...rows)
  return el
}

function renderDeleteButton() {
  els.deleteData.textContent = selected.size
    ? `Delete ${selected.size} selected`
    : 'Delete browsing data…'
}

function render() {
  const visible = snapshot.entries.filter(matches)
  const sections = []

  if (!query && dayFilter === null && snapshot.recentlyClosed.length) {
    const closed = showAllClosed ? snapshot.recentlyClosed : snapshot.recentlyClosed.slice(0, 1)
    const more = document.createElement('button')
    more.className = 'more'
    more.textContent = showAllClosed ? 'Show less' : 'Show more'
    more.onclick = (event) => { event.stopPropagation(); showAllClosed = !showAllClosed; render() }
    sections.push(card(
      'Recently closed',
      closed.map((item) => row(item, { stamp: item.closedAt })),
      snapshot.recentlyClosed.length > 1 ? more : null,
    ))
  }

  for (const [day, entries] of groupByDay(visible)) {
    sections.push(card(dayLabel(day), entries.map((entry) => row(entry))))
  }

  if (!sections.length) {
    const empty = document.createElement('div')
    empty.className = 'empty glass card'
    empty.dataset.glass = ''
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
  void visible
}

function jumpTo(id) {
  const today = startOfDay(Date.now())
  if (id === 'closed') { dayFilter = null; setDateLabel(null); render(); els.results.scrollTo({ top: 0 }); return }
  if (id === 'today') dayFilter = today
  else if (id === 'yesterday') dayFilter = today - DAY
  else if (id === 'older') dayFilter = null
  setDateLabel(dayFilter)
  render()
  if (id === 'older') {
    const cards = els.results.querySelectorAll('.card')
    cards[cards.length - 1]?.scrollIntoView({ block: 'start' })
  }
}

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
els.dateFilter.onclick = () => els.dateInput.showPicker?.()

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
  glass?.observe()
}

load()
