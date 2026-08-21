(function expose(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.EmberMenuOptics = api
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
      neutral: {
        x: targetEdge,
        y: targetEdge,
        width: Math.max(0, width - targetEdge * 2),
        height: Math.max(0, height - targetEdge * 2),
      },
    }
  }

  function projectAxis(position, targetSize, targetEdge, sourceSize, sourceEdge) {
    if (position < targetEdge) {
      const ratio = targetEdge === 1 ? 0 : position / (targetEdge - 1)
      return Math.round(ratio * (sourceEdge - 1))
    }
    if (position >= targetSize - targetEdge) {
      const local = position - (targetSize - targetEdge)
      const ratio = targetEdge === 1 ? 1 : local / (targetEdge - 1)
      return Math.round(sourceSize - sourceEdge + ratio * (sourceEdge - 1))
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
    const smooth = progress * progress * (3 - 2 * progress)
    return 1 - smooth
  }

  function mixChannel(channel, weight) {
    return Math.max(0, Math.min(255, Math.round(NEUTRAL + (channel - NEUTRAL) * weight)))
  }

  function renderDisplacementMap(source, sourceWidth, sourceHeight, targetWidth, targetHeight, edge = 24) {
    const geometry = createMapGeometry(targetWidth, targetHeight, sourceWidth, sourceHeight, edge)
    const { width, height, edge: targetEdge } = geometry.target
    const sourceEdgeX = geometry.source.edgeX
    const sourceEdgeY = geometry.source.edgeY
    const output = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      const sourceY = projectAxis(y, height, targetEdge, sourceHeight, sourceEdgeY)
      for (let x = 0; x < width; x += 1) {
        const targetIndex = (y * width + x) * 4
        const weight = edgeWeight(x, y, geometry)
        if (weight === 0) {
          output[targetIndex] = NEUTRAL
          output[targetIndex + 1] = NEUTRAL
          output[targetIndex + 2] = NEUTRAL
          output[targetIndex + 3] = 255
          continue
        }
        const sourceX = projectAxis(x, width, targetEdge, sourceWidth, sourceEdgeX)
        const sourceIndex = (sourceY * sourceWidth + sourceX) * 4
        output[targetIndex] = mixChannel(source[sourceIndex], weight)
        output[targetIndex + 1] = mixChannel(source[sourceIndex + 1], weight)
        output[targetIndex + 2] = NEUTRAL
        output[targetIndex + 3] = 255
      }
    }
    return output
  }

  function loadImage(source, ImageConstructor) {
    return new Promise((resolve, reject) => {
      const image = new ImageConstructor()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error(`Unable to load displacement source: ${source}`))
      image.src = source
      if (image.complete && image.naturalWidth) resolve(image)
    })
  }

  function createOuterOptics(shell, mapImage, {
    source = '/assets/glass-switcher-map.webp', edge = 24,
    documentRef = typeof document === 'object' ? document : null,
    ImageConstructor = typeof Image === 'function' ? Image : null,
  } = {}) {
    const cache = new Map()
    const sourceImage = documentRef && ImageConstructor
      ? loadImage(source, ImageConstructor)
      : Promise.reject(new Error('Canvas image APIs are unavailable'))

    async function refresh() {
      try {
        const image = await sourceImage
        const width = Math.max(1, Math.round(shell.clientWidth))
        const height = Math.max(1, Math.round(shell.clientHeight))
        const key = `${width}x${height}`
        let dataUrl = cache.get(key)
        if (!dataUrl) {
          const sourceCanvas = documentRef.createElement('canvas')
          sourceCanvas.width = image.naturalWidth
          sourceCanvas.height = image.naturalHeight
          const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
          sourceContext.drawImage(image, 0, 0)
          const sourcePixels = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data
          const pixels = renderDisplacementMap(
            sourcePixels, sourceCanvas.width, sourceCanvas.height, width, height, edge,
          )
          const canvas = documentRef.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const context = canvas.getContext('2d')
          context.putImageData(new ImageData(pixels, width, height), 0, 0)
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
