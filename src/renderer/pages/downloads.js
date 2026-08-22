// ember://downloads — live transfers plus finished history, same glass as ember://history.

const els = {
  results: document.getElementById('results'),
  search: document.getElementById('search'),
  clearSearch: document.getElementById('clear-search'),
  sideNav: document.getElementById('side-nav'),
  sideNote: document.getElementById('side-note'),
  clearFinished: document.getElementById('clear-finished'),
}

const api = window.ember?.downloads

const lg = window.EmberLiquidGlass
const glass = lg ? lg.createGlass(document) : null
glass?.track()

let snapshot = { active: [], entries: [] }
let query = ''
let filter = 'all'

const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const day = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

// Mirrors formatBytes in src/main/downloads.js; kept in the renderer so progress
// can update without a round trip.
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1 }
  return `${value >= 10 || Number.isInteger(value) ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

const extensionOf = (name) => (name || '').split('.').pop().slice(0, 4) || 'file'
const isDone = (entry) => entry.state === 'completed'
const isFailed = (entry) => entry.state === 'cancelled' || entry.state === 'interrupted'

function matches(entry) {
  if (filter === 'active' && entry.endedAt) return false
  if (filter === 'completed' && !isDone(entry)) return false
  if (filter === 'failed' && !isFailed(entry)) return false
  if (!query) return true
  const needle = query.toLowerCase()
  return (entry.filename || '').toLowerCase().includes(needle) || (entry.url || '').toLowerCase().includes(needle)
}

function statusText(entry) {
  const total = entry.totalBytes > 0 ? formatBytes(entry.totalBytes) : null
  if (entry.state === 'completed') return total || 'Done'
  if (entry.state === 'cancelled') return 'Cancelled'
  if (entry.state === 'interrupted') return 'Failed'
  if (entry.state === 'paused') return `Paused — ${formatBytes(entry.receivedBytes)}${total ? ` of ${total}` : ''}`
  return `${formatBytes(entry.receivedBytes)}${total ? ` of ${total}` : ''}`
}

function actionButton(label, action, id, { danger = false } = {}) {
  const button = document.createElement('button')
  button.className = 'dl-action lg-button lg-sm' + (danger ? ' danger' : '')
  button.dataset.lg = ''
  button.textContent = label
  button.onclick = async (event) => {
    event.stopPropagation()
    snapshot = await api.action(action, id)
    render()
  }
  return button
}

function row(entry) {
  const el = document.createElement('div')
  el.className = 'dl-row'
  el.title = entry.url || entry.filename

  const icon = document.createElement('div')
  icon.className = 'dl-icon' + (isFailed(entry) ? ' failed' : '')
  icon.textContent = extensionOf(entry.filename)

  const body = document.createElement('div')
  body.className = 'dl-body'

  const name = document.createElement('div')
  name.className = 'dl-name'
  name.textContent = entry.filename || entry.url

  const meta = document.createElement('div')
  meta.className = 'dl-meta'
  const status = document.createElement('span')
  if (isFailed(entry)) status.className = 'failed'
  status.textContent = statusText(entry)
  const sep = document.createElement('span')
  sep.className = 'sep'
  sep.textContent = '·'
  const when = document.createElement('span')
  when.textContent = entry.endedAt ? time.format(new Date(entry.endedAt)) : time.format(new Date(entry.startedAt))
  meta.append(status, sep, when)

  body.append(name, meta)

  const running = !entry.endedAt
  if (running) {
    const bar = document.createElement('div')
    bar.className = 'dl-progress'
    const fill = document.createElement('span')
    if (entry.totalBytes > 0) {
      fill.style.width = `${Math.round((entry.receivedBytes / entry.totalBytes) * 100)}%`
    } else {
      bar.classList.add('indeterminate')
    }
    bar.append(fill)
    body.append(bar)
  }

  const actions = document.createElement('div')
  actions.className = 'dl-actions'
  if (running) {
    actions.append(
      entry.state === 'paused'
        ? actionButton('Resume', 'resume', entry.id)
        : actionButton('Pause', 'pause', entry.id),
      actionButton('Cancel', 'cancel', entry.id, { danger: true }),
    )
  } else if (isDone(entry)) {
    actions.append(
      actionButton('Open', 'open', entry.id),
      actionButton('Show', 'show', entry.id),
      actionButton('Remove', 'remove', entry.id, { danger: true }),
    )
  } else {
    actions.append(actionButton('Remove', 'remove', entry.id, { danger: true }))
  }

  el.append(icon, body, actions)
  return el
}

function card(title, rows) {
  const el = document.createElement('section')
  el.className = 'card'
  el.dataset.lg = ''
  const head = document.createElement('div')
  head.className = 'card-head'
  const label = document.createElement('span')
  label.textContent = title
  head.append(label)
  el.append(head, ...rows)
  lg?.attachLens(el, { items: '.dl-row', radius: 13 })
  return el
}

function startOfDay(value) { const d = new Date(value); d.setHours(0, 0, 0, 0); return d.getTime() }

function render() {
  const sections = []
  const active = snapshot.active.filter(matches)
  const finished = snapshot.entries.filter(matches)

  if (active.length) sections.push(card('In progress', active.map(row)))

  const groups = new Map()
  for (const entry of finished) {
    const key = startOfDay(entry.endedAt || entry.startedAt)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(entry)
  }
  const today = startOfDay(Date.now())
  for (const [key, entries] of [...groups.entries()].sort((a, b) => b[0] - a[0])) {
    const label = key === today ? `Today - ${day.format(new Date(key))}` : day.format(new Date(key))
    sections.push(card(label, entries.map(row)))
  }

  if (!sections.length) {
    const empty = document.createElement('div')
    empty.className = 'empty card'
    empty.dataset.lg = ''
    const strong = document.createElement('strong')
    strong.textContent = query || filter !== 'all' ? 'Nothing matches' : 'No downloads yet'
    empty.append(strong, document.createTextNode(
      query || filter !== 'all'
        ? 'Try a different search or filter.'
        : 'Files you download will appear here, with progress you can pause.',
    ))
    sections.push(empty)
  }

  els.results.replaceChildren(...sections)
  renderSide()
  glass?.refresh()
}

function renderSide() {
  const counts = {
    all: snapshot.active.length + snapshot.entries.length,
    active: snapshot.active.length,
    completed: snapshot.entries.filter(isDone).length,
    failed: snapshot.entries.filter(isFailed).length,
  }
  const options = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'In progress' },
    { id: 'completed', label: 'Completed' },
    { id: 'failed', label: 'Failed' },
  ]
  els.sideNav.replaceChildren(...options.map(({ id, label }) => {
    const button = document.createElement('button')
    button.className = 'side-link'
    button.disabled = counts[id] === 0 && id !== 'all'
    const dot = document.createElement('span')
    dot.className = 'dot'
    const text = document.createElement('span')
    text.textContent = counts[id] ? `${label} (${counts[id]})` : label
    button.append(dot, text)
    button.onclick = () => { filter = id; render() }
    return button
  }))
  lg?.attachLens(els.sideNav, { items: '.side-link', radius: 10 })

  const bytes = snapshot.entries.filter(isDone).reduce((sum, entry) => sum + (entry.totalBytes || 0), 0)
  lg?.setLabel(els.sideNote, counts.completed
    ? `${counts.completed} file${counts.completed === 1 ? '' : 's'}, ${formatBytes(bytes)} downloaded`
    : 'Nothing downloaded yet')
}

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
els.clearFinished.onclick = async () => {
  snapshot = await api.action('clear')
  render()
}

api?.onChange((next) => { snapshot = next; render() })

async function load() {
  snapshot = (await api?.query()) || { active: [], entries: [] }
  render()
}

load()
