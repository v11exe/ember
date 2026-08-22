// Overlays refract a real screenshot of the page behind them. Over a white page
// that leaves light text on light glass, which is unreadable.
//
// This measures the captured backdrop and flags the document as light or dark,
// so the palette can flip. Same idea as liquid-glass-react's `overLight`.
(function expose(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.EmberBackdropContrast = api
}(typeof globalThis === 'object' ? globalThis : this, () => {
  // Rec. 709 luma: green dominates perceived brightness.
  function luminanceOf(data) {
    let total = 0
    let counted = 0
    // Every 4th pixel is plenty for an average and keeps this off the critical path.
    for (let i = 0; i < data.length; i += 16) {
      total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      counted += 1
    }
    return counted ? total / counted / 255 : 0
  }

  /** Above this the backdrop counts as light and the palette flips. */
  const LIGHT_THRESHOLD = 0.55

  function classify(luminance) {
    return luminance >= LIGHT_THRESHOLD ? 'light' : 'dark'
  }

  /** @returns {Promise<{ luminance: number, contrast: 'light'|'dark' }>} */
  function measure(dataUrl, documentRef = document) {
    return new Promise((resolve) => {
      if (!dataUrl) { resolve({ luminance: 0, contrast: 'dark' }); return }
      const image = new Image()
      image.onload = () => {
        try {
          // A tiny sample is enough for an average and costs almost nothing.
          const width = Math.max(1, Math.min(48, image.naturalWidth))
          const height = Math.max(1, Math.min(48, image.naturalHeight))
          const canvas = documentRef.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const context = canvas.getContext('2d', { willReadFrequently: true })
          context.drawImage(image, 0, 0, width, height)
          const luminance = luminanceOf(context.getImageData(0, 0, width, height).data)
          resolve({ luminance, contrast: classify(luminance) })
        } catch {
          resolve({ luminance: 0, contrast: 'dark' })
        }
      }
      image.onerror = () => resolve({ luminance: 0, contrast: 'dark' })
      image.src = dataUrl
    })
  }

  /** Measure and stamp the result on <html> for CSS to react to. */
  async function apply(dataUrl, documentRef = document) {
    const result = await measure(dataUrl, documentRef)
    documentRef.documentElement.dataset.backdrop = result.contrast
    return result
  }

  return { measure, apply, classify, luminanceOf, LIGHT_THRESHOLD }
}))
