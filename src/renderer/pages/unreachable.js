// ember://unreachable?url=…&code=…&reason=…
//
// Shown in place of a page that never arrived. Retry goes back to the original
// address; the archive is offered, never taken automatically.

const params = new URLSearchParams(location.search)
const target = params.get('url') || ''
const reason = params.get('reason') || ''

const lg = window.EmberLiquidGlass
const glass = lg ? lg.createGlass(document) : null
glass?.track()

const els = {
  address: document.getElementById('address'),
  reason: document.getElementById('reason'),
  retry: document.getElementById('retry'),
  archived: document.getElementById('archived'),
  status: document.getElementById('status'),
}

els.address.textContent = target
els.reason.textContent = reason
document.title = target ? `${target} is unavailable` : 'Page unavailable'

els.retry.onclick = () => {
  if (target) window.ember?.navigate(target)
}

els.archived.onclick = async () => {
  if (!target) return
  els.archived.disabled = true
  els.status.textContent = 'Asking the Internet Archive…'
  const result = await window.ember?.archive?.open(target)
  if (result?.ok) return // the tab is already on its way to the snapshot
  els.archived.disabled = false
  els.status.textContent = result?.reason === 'unsupported'
    ? 'The archive only holds public web pages.'
    : 'The Internet Archive has no copy of this page.'
}

glass?.refresh()
