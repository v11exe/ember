(function expose(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.EmberUploadOptics = api
}(typeof globalThis === 'object' ? globalThis : this, () => {
  const NEUTRAL = 128

  function createMapGeometry(targetWidth, targetHeight, sourceWidth, sourceHeight, edge = 24) {
    const width = Math.max(1, Math.round(targetWidth))
    const height = Math.max(1, Math.round(targetHeight))
    const sourceW = Math.max(1, Math.round(sourceWidth))
    const sourceH = Math.max(1, Math.round(sourceHeight))
    const targetEdge = Math.max(1, Math.min(Math.round(edge), Math.floor(width / 2), Math.floor(height / 2)))
    const sourceEdgeY = Math.max(1, Math.floor(sourceH / 2))
    const sourceEdgeX = Math.max(1, Math.min(Math.floor(sourceW / 2), sourceEdgeY))
    return {
      target: { width, height, edge: targetEdge },
      source: { width: sourceW, height: sourceH, edgeX: sourceEdgeX, edgeY: sourceEdgeY },
      neutral: { x: targetEdge, y: targetEdge, width: Math.max(0, width - targetEdge * 2), height: Math.max(0, height - targetEdge * 2) },
    }
  }

  function projectAxis(position, targetSize, targetEdge, sourceSize, sourceEdge) {
    if (position < targetEdge) return Math.round((targetEdge === 1 ? 0 : position / (targetEdge - 1)) * (sourceEdge - 1))
    if (position >= targetSize - targetEdge) {
      const local = position - (targetSize - targetEdge)
      return Math.round(sourceSize - sourceEdge + (targetEdge === 1 ? 1 : local / (targetEdge - 1)) * (sourceEdge - 1))
    }
    return Math.floor((sourceSize - 1) / 2)
  }

  function edgeWeight(x, y, geometry) {
    const { width, height, edge } = geometry.target
    const distance = Math.min(x, y, width - 1 - x, height - 1 - y)
    if (distance >= edge) return 0
    const fadeStart = edge * 0.58
    if (distance <= fadeStart) return 1
    const progress = (distance - fadeStart) / (edge - fadeStart)
    return 1 - progress * progress * (3 - 2 * progress)
  }

  function renderDisplacementMap(source, sourceWidth, sourceHeight, targetWidth, targetHeight, edge = 24) {
    const geometry = createMapGeometry(targetWidth, targetHeight, sourceWidth, sourceHeight, edge)
    const { width, height, edge: targetEdge } = geometry.target
    const output = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      const sourceY = projectAxis(y, height, targetEdge, sourceHeight, geometry.source.edgeY)
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4
        const weight = edgeWeight(x, y, geometry)
        if (weight === 0) { output[index] = NEUTRAL; output[index + 1] = NEUTRAL; output[index + 2] = NEUTRAL; output[index + 3] = 255; continue }
        const sourceX = projectAxis(x, width, targetEdge, sourceWidth, geometry.source.edgeX)
        const sourceIndex = (sourceY * sourceWidth + sourceX) * 4
        output[index] = Math.round(NEUTRAL + (source[sourceIndex] - NEUTRAL) * weight)
        output[index + 1] = Math.round(NEUTRAL + (source[sourceIndex + 1] - NEUTRAL) * weight)
        output[index + 2] = NEUTRAL
        output[index + 3] = 255
      }
    }
    return output
  }

  function createOuterOptics(shell, mapImage, { source = '/assets/glass-switcher-map.webp', edge = 24 } = {}) {
    const cache = new Map()
    const sourceImage = new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Unable to load upload displacement source'))
      image.src = source
    })
    async function refresh() {
      try {
        const image = await sourceImage
        const width = Math.max(1, Math.round(shell.clientWidth))
        const height = Math.max(1, Math.round(shell.clientHeight))
        const key = `${width}x${height}`
        let dataUrl = cache.get(key)
        if (!dataUrl) {
          const sourceCanvas = document.createElement('canvas')
          sourceCanvas.width = image.naturalWidth; sourceCanvas.height = image.naturalHeight
          const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
          sourceContext.drawImage(image, 0, 0)
          const pixels = renderDisplacementMap(sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data, sourceCanvas.width, sourceCanvas.height, width, height, edge)
          const canvas = document.createElement('canvas')
          canvas.width = width; canvas.height = height
          canvas.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0)
          dataUrl = canvas.toDataURL('image/png')
          cache.set(key, dataUrl)
        }
        mapImage.setAttribute('href', dataUrl)
        shell.dataset.opticsReady = 'true'
        return true
      } catch {
        shell.dataset.opticsReady = 'fallback'
        return false
      }
    }
    return { refresh }
  }

  return { createMapGeometry, createOuterOptics, renderDisplacementMap }
}))
