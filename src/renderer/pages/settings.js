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

const detail = document.getElementById('startup-detail')
const sleepDetail = document.getElementById('hibernation-detail')

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

for (const button of document.querySelectorAll('[data-open]')) {
  button.onclick = () => window.ember?.navigate(button.dataset.open)
}

async function load() {
  const settings = await api?.get()
  renderSessionRestore(settings?.sessionRestore || 'ask')
  renderHibernation(settings?.hibernation)
  document.getElementById('version').textContent = settings?.appVersion ? `Version ${settings.appVersion}` : ''
  glass?.refresh()
  // Each card is a small menu, so it gets the dropdown's sliding lens too.
  for (const card of document.querySelectorAll('.card')) {
    lg?.attachLens(card, { items: '.setting', radius: 13 })
  }
}

load()
