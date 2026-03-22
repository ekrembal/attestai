import QRCode from "qrcode"
import QrScanner from "qr-scanner"

export type ScannerController = {
  start: () => Promise<void>
  stop: () => void
  destroy: () => void
}

type TestOverrides = {
  createScanner?: (
    video: HTMLVideoElement,
    onDecode: (result: { data: string }) => void,
    onDecodeError: (error: Error | string) => void,
  ) => ScannerController
  scanImage?: (file: File) => Promise<string>
}

declare global {
  interface Window {
    __qrToolsTestOverrides?: TestOverrides
  }
}

export function isProbablyUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export async function generateQrDataUrl(value: string) {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    type: "image/png",
    width: 720,
    color: {
      dark: "#111111",
      light: "#ffffff",
    },
  })
}

export function createScanner(
  video: HTMLVideoElement,
  onDecode: (result: { data: string }) => void,
  onDecodeError: (error: Error | string) => void,
) {
  const override = window.__qrToolsTestOverrides?.createScanner
  if (override) {
    return override(video, onDecode, onDecodeError)
  }

  const scanner = new QrScanner(
    video,
    (result) => onDecode({ data: result.data }),
    {
      preferredCamera: "environment",
      returnDetailedScanResult: true,
      highlightScanRegion: true,
      highlightCodeOutline: true,
      onDecodeError,
    },
  )

  return {
    start: () => scanner.start(),
    stop: () => scanner.stop(),
    destroy: () => scanner.destroy(),
  } satisfies ScannerController
}

export async function scanQrImage(file: File) {
  const override = window.__qrToolsTestOverrides?.scanImage
  if (override) {
    return override(file)
  }

  const result = await QrScanner.scanImage(file, {
    returnDetailedScanResult: true,
  })

  return result.data
}

export function getCameraErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unable to access the camera."
  }

  const message = error.message.toLowerCase()
  if (error.name === "NotAllowedError" || message.includes("denied")) {
    return "Camera access was denied. Allow permission in your browser and try again."
  }

  if (error.name === "NotFoundError" || message.includes("found")) {
    return "No camera was found on this device."
  }

  if (error.name === "NotReadableError" || message.includes("in use")) {
    return "The camera is already in use by another app."
  }

  if (error.name === "OverconstrainedError") {
    return "This device could not start the requested camera."
  }

  return error.message || "Unable to access the camera."
}

export function getFileName(value: string) {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)

  return `${base || "qr-code"}.png`
}
