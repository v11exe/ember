(function bindShellMetrics() {
  function applyShellMetrics({ width, height, x, y } = {}) {
    const style = document.documentElement.style
    style.setProperty('--shell-width', `${Math.max(1, Number(width) || innerWidth)}px`)
    style.setProperty('--shell-height', `${Math.max(1, Number(height) || innerHeight)}px`)
    style.setProperty('--shell-x', `${Number(x) || 0}px`)
    style.setProperty('--shell-y', `${Number(y) || 0}px`)
  }

  const bridge = window.emberShell || window.emberCornerMask || window.ember
  bridge?.onShellMetrics?.(applyShellMetrics)
})()
