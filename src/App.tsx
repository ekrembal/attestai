import { useDeferredValue, useEffect, useRef, useState, type ChangeEvent } from "react"
import { Camera, Download, ImagePlus, QrCode, Share2 } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  createScanner,
  generateQrDataUrl,
  getCameraErrorMessage,
  getFileName,
  scanQrImage,
  type ScannerController,
} from "@/lib/qr"

type TabValue = "create" | "scan"

async function dataUrlToFile(dataUrl: string, fileName: string) {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  return new File([blob], fileName, { type: blob.type || "image/png" })
}

function App() {
  const [tab, setTab] = useState<TabValue>("create")
  const [input, setInput] = useState("https://example.com")
  const deferredInput = useDeferredValue(input)
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [shareError, setShareError] = useState("")
  const [scanResult, setScanResult] = useState("")
  const [scanStatus, setScanStatus] = useState("Choose Camera or Gallery to scan a QR code.")
  const [scanError, setScanError] = useState("")
  const [cameraError, setCameraError] = useState("")
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const scannerRef = useRef<ScannerController | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!deferredInput.trim()) {
      setQrDataUrl("")
      setIsGenerating(false)
      return
    }

    setIsGenerating(true)
    generateQrDataUrl(deferredInput)
      .then((nextUrl) => {
        if (!cancelled) {
          setQrDataUrl(nextUrl)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl("")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsGenerating(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [deferredInput])

  useEffect(() => {
    return () => {
      scannerRef.current?.destroy()
      scannerRef.current = null
    }
  }, [])

  const stopScanner = () => {
    scannerRef.current?.stop()
    scannerRef.current?.destroy()
    scannerRef.current = null
  }

  const handleTabChange = (value: string) => {
    if (value !== "create" && value !== "scan") {
      return
    }

    if (value === "create") {
      stopScanner()
      setCameraError("")
      setScanError("")
      setScanStatus("Choose Camera or Gallery to scan a QR code.")
    }

    setTab(value)
  }

  const handleDownload = () => {
    if (!qrDataUrl || !input.trim()) {
      return
    }

    const link = document.createElement("a")
    link.href = qrDataUrl
    link.download = getFileName(input)
    link.click()
  }

  const handleShare = async () => {
    if (!qrDataUrl || !input.trim()) {
      return
    }

    setShareError("")

    try {
      const file = await dataUrlToFile(qrDataUrl, getFileName(input))

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "QR Tools",
          text: input,
          files: [file],
        })
        return
      }

      if (navigator.share) {
        await navigator.share({
          title: "QR Tools",
          text: input,
        })
        return
      }

      throw new Error("Sharing is not supported on this device.")
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return
      }

      setShareError(error instanceof Error ? error.message : "Sharing failed.")
    }
  }

  const handleScanResult = (value: string) => {
    stopScanner()
    setScanResult(value)
    setScanError("")
    setCameraError("")
    setScanStatus("QR code detected.")
  }

  const handleCamera = async () => {
    if (!videoRef.current) {
      return
    }

    setTab("scan")
    setScanError("")
    setCameraError("")
    setScanResult("")
    setScanStatus("Opening camera…")

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not support camera scanning.")
      setScanStatus("Camera unavailable.")
      return
    }

    stopScanner()

    const scanner = createScanner(
      videoRef.current,
      (result) => handleScanResult(result.data),
      () => {
        setScanStatus("Looking for a QR code…")
      },
    )

    scannerRef.current = scanner

    try {
      await scanner.start()
      setScanStatus("Camera active. Point it at a QR code.")
    } catch (error) {
      scanner.destroy()
      scannerRef.current = null
      setCameraError(getCameraErrorMessage(error))
      setScanStatus("Camera unavailable.")
    }
  }

  const handleGallery = () => {
    setTab("scan")
    setScanError("")
    setScanResult("")
    fileInputRef.current?.click()
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) {
      return
    }

    stopScanner()
    setScanError("")
    setCameraError("")
    setScanStatus("Scanning image…")

    if (!file.type.startsWith("image/")) {
      setScanError("Choose an image that contains a QR code.")
      setScanStatus("Image scan failed.")
      return
    }

    try {
      const result = await scanQrImage(file)
      handleScanResult(result)
    } catch {
      setScanResult("")
      setScanError("No QR code was found in that image.")
      setScanStatus("Image scan failed.")
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(244,244,245,0.92)_55%,_rgba(228,228,231,0.84))] px-4 py-6 text-foreground sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <header className="space-y-1 px-1">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <QrCode className="size-4" />
            QR Tools
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Create and scan QR codes</h1>
        </header>

        <Tabs value={tab} onValueChange={handleTabChange} className="gap-4">
          <TabsList className="grid h-11 w-full grid-cols-2 rounded-2xl bg-black/5 p-1">
            <TabsTrigger value="create" className="rounded-xl text-sm">
              Create QR
            </TabsTrigger>
            <TabsTrigger value="scan" className="rounded-xl text-sm">
              Scan QR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card className="rounded-3xl border-0 bg-white/80 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_18px_50px_rgba(0,0,0,0.08)] backdrop-blur">
              <CardHeader className="space-y-1">
                <CardTitle>Paste text or a link</CardTitle>
                <CardDescription>The QR code updates on-device as you type.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={5}
                  placeholder="Enter any text"
                  className="min-h-32 resize-none rounded-2xl border-black/10 bg-white/90 px-4 py-3 text-base shadow-none focus-visible:ring-black/20"
                />

                <div className="flex min-h-72 items-center justify-center rounded-[28px] border border-black/10 bg-stone-50 p-4">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Generated QR code"
                      className="aspect-square w-full max-w-[280px] rounded-3xl bg-white p-3"
                    />
                  ) : (
                    <p className="max-w-48 text-center text-sm text-muted-foreground">
                      {isGenerating ? "Generating QR code…" : "Add content to generate a QR code."}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleDownload}
                    disabled={!qrDataUrl}
                    variant="outline"
                    size="lg"
                    className="h-11 rounded-2xl"
                  >
                    <Download />
                    Download
                  </Button>
                  <Button
                    onClick={handleShare}
                    disabled={!qrDataUrl}
                    size="lg"
                    className="h-11 rounded-2xl"
                  >
                    <Share2 />
                    Share
                  </Button>
                </div>

                {shareError ? (
                  <Alert className="rounded-2xl border-black/10 bg-white">
                    <AlertDescription>{shareError}</AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scan">
            <Card className="rounded-3xl border-0 bg-white/80 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_18px_50px_rgba(0,0,0,0.08)] backdrop-blur">
              <CardHeader className="space-y-1">
                <CardTitle>Scan a QR code</CardTitle>
                <CardDescription>Use the camera or pick an image from your gallery.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={handleCamera} variant="outline" size="lg" className="h-11 rounded-2xl">
                    <Camera />
                    Camera
                  </Button>
                  <Button onClick={handleGallery} size="lg" className="h-11 rounded-2xl">
                    <ImagePlus />
                    Gallery
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />

                <div className="overflow-hidden rounded-[28px] border border-black/10 bg-stone-950">
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="aspect-[4/5] w-full object-cover"
                  />
                </div>

                <div className="rounded-[28px] border border-black/10 bg-stone-50 p-4">
                  <p className="text-sm text-muted-foreground">{scanStatus}</p>
                  <p className="mt-3 break-words text-sm font-medium text-foreground">
                    {scanResult || "No scan result yet."}
                  </p>
                </div>

                {cameraError ? (
                  <Alert className="rounded-2xl border-black/10 bg-white">
                    <AlertDescription>{cameraError}</AlertDescription>
                  </Alert>
                ) : null}

                {scanError ? (
                  <Alert className="rounded-2xl border-black/10 bg-white">
                    <AlertDescription>{scanError}</AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

export default App
