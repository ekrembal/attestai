export type ImageProcessResult = {
  blob: Blob
  fileName: string
  originalSize: number
  outputSize: number
  passed: boolean
  message: string
}

export type ImageMetrics = {
  width: number
  height: number
}

type LoadedImage = ImageMetrics & {
  element: HTMLImageElement
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }

      reject(new Error("Could not read the selected file."))
    }
    reader.onerror = () => reject(new Error("Could not read the selected file."))
    reader.readAsDataURL(file)
  })
}

async function loadImage(file: File): Promise<LoadedImage> {
  const src = await fileToDataUrl(file)

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      resolve({
        element: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }
    image.onerror = () =>
      reject(new Error("The selected image could not be decoded."))
    image.src = src
  })
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("The browser could not export the image."))
          return
        }

        resolve(blob)
      },
      "image/jpeg",
      quality
    )
  })
}

async function exportCandidate(
  width: number,
  height: number,
  quality: number,
  draw: (context: CanvasRenderingContext2D) => void
) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("Canvas support is required for browser-side processing.")
  }

  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, width, height)
  draw(context)

  return canvasToBlob(canvas, quality)
}

function getImageMessage(
  passed: boolean,
  outputSize: number,
  targetBytes: number,
  width: number,
  height: number
) {
  if (passed) {
    return `Ready. The exported image is ${width} × ${height}px and fits under ${formatLimit(targetBytes)}.`
  }

  return `Closest browser-side result is ${formatLimit(outputSize)} at ${width} × ${height}px. Try a higher limit or a smaller source image.`
}

function formatLimit(value: number) {
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(0)} KB`
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

export async function loadImageMetrics(file: File) {
  const image = await loadImage(file)
  return {
    width: image.width,
    height: image.height,
  }
}

export async function compressImageToTarget(
  file: File,
  targetBytes: number
): Promise<ImageProcessResult> {
  const image = await loadImage(file)

  if (file.size <= targetBytes) {
    return {
      blob: file,
      fileName: file.name,
      originalSize: file.size,
      outputSize: file.size,
      passed: true,
      message: `The original image already fits under ${formatLimit(targetBytes)}.`,
    }
  }

  const scaleSteps = [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.45]
  const qualitySteps = [0.88, 0.8, 0.72, 0.64, 0.56, 0.48, 0.4]
  let bestBlob: Blob | null = null
  let bestWidth = image.width
  let bestHeight = image.height

  for (const scale of scaleSteps) {
    const width = Math.max(320, Math.round(image.width * scale))
    const height = Math.max(320, Math.round(image.height * scale))

    for (const quality of qualitySteps) {
      const blob = await exportCandidate(
        width,
        height,
        quality,
        (context) => {
          context.drawImage(image.element, 0, 0, width, height)
        }
      )

      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob
        bestWidth = width
        bestHeight = height
      }

      if (blob.size <= targetBytes) {
        return {
          blob,
          fileName: file.name,
          originalSize: file.size,
          outputSize: blob.size,
          passed: true,
          message: getImageMessage(true, blob.size, targetBytes, width, height),
        }
      }
    }
  }

  if (!bestBlob) {
    throw new Error("No image output could be produced.")
  }

  return {
    blob: bestBlob,
    fileName: file.name,
    originalSize: file.size,
    outputSize: bestBlob.size,
    passed: bestBlob.size <= targetBytes,
    message: getImageMessage(
      bestBlob.size <= targetBytes,
      bestBlob.size,
      targetBytes,
      bestWidth,
      bestHeight
    ),
  }
}

export async function createPassportPhoto(
  file: File,
  outputSize: number,
  targetBytes: number
): Promise<ImageProcessResult> {
  const image = await loadImage(file)
  const cropSize = Math.min(image.width, image.height)
  const offsetX = Math.round((image.width - cropSize) / 2)
  const offsetY = Math.round((image.height - cropSize) / 2)
  const qualitySteps = [0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.44]
  let bestBlob: Blob | null = null

  for (const quality of qualitySteps) {
    const blob = await exportCandidate(
      outputSize,
      outputSize,
      quality,
      (context) => {
        context.drawImage(
          image.element,
          offsetX,
          offsetY,
          cropSize,
          cropSize,
          0,
          0,
          outputSize,
          outputSize
        )
      }
    )

    if (!bestBlob || blob.size < bestBlob.size) {
      bestBlob = blob
    }

    if (blob.size <= targetBytes) {
      return {
        blob,
        fileName: file.name,
        originalSize: file.size,
        outputSize: blob.size,
        passed: true,
        message: `Passport-ready export created at ${outputSize} × ${outputSize}px and ${formatLimit(blob.size)}.`,
      }
    }
  }

  if (!bestBlob) {
    throw new Error("No passport photo output could be produced.")
  }

  return {
    blob: bestBlob,
    fileName: file.name,
    originalSize: file.size,
    outputSize: bestBlob.size,
    passed: bestBlob.size <= targetBytes,
    message: `Square export created at ${outputSize} × ${outputSize}px, but it remains ${formatLimit(bestBlob.size)}. Try a higher size limit.`,
  }
}
