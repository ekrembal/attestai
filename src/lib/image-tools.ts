export type OutputFormat = "webp" | "png" | "jpeg" | "avif"

export type ResizeSettings = {
  enabled: boolean
  width?: number
  height?: number
  keepAspectRatio: boolean
  preventUpscale: boolean
}

export type ProcessSettings = {
  format: OutputFormat
  quality: number
  resize: ResizeSettings
}

export type EncodedImage = {
  blob: Blob
  width: number
  height: number
  fileName: string
  mimeType: string
}

const MIME_BY_FORMAT: Record<OutputFormat, string> = {
  webp: "image/webp",
  png: "image/png",
  jpeg: "image/jpeg",
  avif: "image/avif",
}

const EXTENSION_BY_FORMAT: Record<OutputFormat, string> = {
  webp: "webp",
  png: "png",
  jpeg: "jpg",
  avif: "avif",
}

export const ACCEPTED_IMAGE_TYPES = Object.values(MIME_BY_FORMAT)

export function getMimeType(format: OutputFormat) {
  return MIME_BY_FORMAT[format]
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unitIndex]}`
}

export function formatDimensions(width: number, height: number) {
  return `${width} × ${height}`
}

export function getSizeDeltaLabel(beforeBytes: number, afterBytes: number) {
  const delta = afterBytes - beforeBytes
  if (delta === 0) {
    return "No size change"
  }

  const absDelta = formatBytes(Math.abs(delta))
  const direction = delta < 0 ? "smaller" : "larger"
  const percent = beforeBytes > 0 ? Math.abs((delta / beforeBytes) * 100) : 0

  return `${absDelta} ${direction} (${percent.toFixed(1)}%)`
}

export function getOutputFileName(fileName: string, format: OutputFormat) {
  const extension = EXTENSION_BY_FORMAT[format]
  const nameWithoutExtension = fileName.replace(/\.[^.]+$/, "") || "image"

  return `${nameWithoutExtension}.${extension}`
}

export async function detectFormatSupport() {
  const entries = await Promise.all(
    (Object.keys(MIME_BY_FORMAT) as OutputFormat[]).map(async (format) => {
      const supported = await canEncodeMimeType(MIME_BY_FORMAT[format])
      return [format, supported] as const
    }),
  )

  return Object.fromEntries(entries) as Record<OutputFormat, boolean>
}

export async function readImageMetadata(file: File) {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImageElement(objectUrl)
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      objectUrl,
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

export async function processImage(
  file: File,
  originalWidth: number,
  originalHeight: number,
  settings: ProcessSettings,
) {
  const mimeType = MIME_BY_FORMAT[settings.format]

  if (!(await canEncodeMimeType(mimeType))) {
    throw new Error(`${settings.format.toUpperCase()} export is not supported in this browser.`)
  }

  const sourceUrl = URL.createObjectURL(file)

  try {
    const image = await loadImageElement(sourceUrl)
    const { width, height } = getTargetDimensions(
      originalWidth,
      originalHeight,
      settings.resize,
    )

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("Canvas rendering is not available in this browser.")
    }

    if (mimeType === "image/jpeg") {
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, width, height)
    }

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(image, 0, 0, width, height)

    const blob = await canvasToBlob(
      canvas,
      mimeType,
      mimeType === "image/png" ? undefined : settings.quality,
    )

    return {
      blob,
      width,
      height,
      fileName: getOutputFileName(file.name, settings.format),
      mimeType,
    } satisfies EncodedImage
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

function getTargetDimensions(
  originalWidth: number,
  originalHeight: number,
  resize: ResizeSettings,
) {
  if (!resize.enabled) {
    return { width: originalWidth, height: originalHeight }
  }

  const nextWidth = resize.width
  const nextHeight = resize.height

  if (!nextWidth && !nextHeight) {
    return { width: originalWidth, height: originalHeight }
  }

  if (!resize.keepAspectRatio) {
    return {
      width: clampDimension(nextWidth ?? originalWidth),
      height: clampDimension(nextHeight ?? originalHeight),
    }
  }

  if (nextWidth && nextHeight) {
    const ratio = Math.min(nextWidth / originalWidth, nextHeight / originalHeight)
    const scale = resize.preventUpscale ? Math.min(1, ratio) : ratio

    return {
      width: clampDimension(Math.round(originalWidth * scale)),
      height: clampDimension(Math.round(originalHeight * scale)),
    }
  }

  if (nextWidth) {
    const ratio = nextWidth / originalWidth
    const scale = resize.preventUpscale ? Math.min(1, ratio) : ratio

    return {
      width: clampDimension(Math.round(originalWidth * scale)),
      height: clampDimension(Math.round(originalHeight * scale)),
    }
  }

  const ratio = (nextHeight ?? originalHeight) / originalHeight
  const scale = resize.preventUpscale ? Math.min(1, ratio) : ratio

  return {
    width: clampDimension(Math.round(originalWidth * scale)),
    height: clampDimension(Math.round(originalHeight * scale)),
  }
}

function clampDimension(value: number) {
  return Math.max(1, Math.min(8192, value))
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("The image could not be decoded."))
    image.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("The browser could not encode this image format."))
          return
        }

        resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}

async function canEncodeMimeType(mimeType: string) {
  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1

  try {
    const dataUrl = canvas.toDataURL(mimeType)
    return dataUrl.startsWith(`data:${mimeType}`)
  } catch {
    return false
  }
}
