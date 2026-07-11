import { toPng } from 'html-to-image'

/**
 * Render sebuah node jadi PNG lalu bagikan lewat Web Share API (WhatsApp dll).
 * Fallback: unduh gambar. Mengembalikan 'shared' | 'downloaded'.
 */
export async function shareNodeAsPng(
  node: HTMLElement,
  filename: string,
  shareTitle: string,
): Promise<'shared' | 'downloaded'> {
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: '#ffffff',
  })
  const blob = await (await fetch(dataUrl)).blob()
  const file = new File([blob], filename, { type: 'image/png' })

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean
  }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: shareTitle })
      return 'shared'
    } catch {
      // dibatalkan pengguna; jatuh ke unduh
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
