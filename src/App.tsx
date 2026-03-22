import { useDeferredValue, useEffect, useRef, useState, type ChangeEvent } from "react"
import {
  AlertCircle,
  Camera,
  Check,
  Copy,
  Download,
  ExternalLink,
  ImageUp,
  Link2,
  QrCode,
  RefreshCw,
  ScanLine,
  Square,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  createScanner,
  generateQrDataUrl,
  getCameraErrorMessage,
  getFileName,
  isProbablyUrl,
  scanQrImage,
  type ScannerController,
} from "@/lib/qr"

type TabValue = "create" | "read"

const QUERY_KEY = "text"

function getInitialState(): { tab: TabValue; text: string } {
  const params = new URLSearchParams(window.location.search)
  const tab = params.get("tab") === "read" ? "read" : "create"
  const text = params.get(QUERY_KEY) ?? ""

  return { tab, text }
}

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value)
}

function App() {
  const [initialState] = useState(getInitialState)
  const [tab, setTab] = useState<TabValue>(initialState.tab)
  const [qrInput, setQrInput] = useState(initialState.text)
  const deferredQrInput = useDeferredValue(qrInput)
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [copyState, setCopyState] = useState<"" | "link" | "text" | "result">("")
  const [readResult, setReadResult] = useState("")
  const [readError, setReadError] = useState("")
  const [readStatus, setReadStatus] = useState("Start the camera or upload an image to decode a QR code.")
  const [isScanning, setIsScanning] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const [fileName, setFileName] = useState("")
  const scannerRef = useRef<ScannerController | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (qrInput.trim()) {
      params.set(QUERY_KEY, qrInput)
    } else {
      params.delete(QUERY_KEY)
    }

    if (tab === "read") {
      params.set("tab", "read")
    } else {
      params.delete("tab")
    }

    const query = params.toString()
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname
    window.history.replaceState({}, "", nextUrl)
  }, [qrInput, tab])

  useEffect(() => {
    let cancelled = false

    if (!deferredQrInput) {
      setQrDataUrl("")
      setIsGenerating(false)
      return
    }

    setIsGenerating(true)

    generateQrDataUrl(deferredQrInput)
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl)
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
  }, [deferredQrInput])

  useEffect(() => {
    if (!copyState) {
      return
    }

    const timeout = window.setTimeout(() => setCopyState(""), 1600)
    return () => window.clearTimeout(timeout)
  }, [copyState])

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
    setIsScanning(false)
  }

  const handleScanResult = (value: string) => {
    stopScanner()
    setReadError("")
    setReadResult(value)
    setReadStatus("QR code decoded successfully.")
  }

  const handleTabChange = (nextTab: string) => {
    if (nextTab !== "create" && nextTab !== "read") {
      return
    }

    if (nextTab === "create") {
      stopScanner()
      setCameraError("")
    }

    setTab(nextTab)
  }

  const handleCopy = async (value: string, type: "link" | "text" | "result") => {
    try {
      await copyToClipboard(value)
      setCopyState(type)
    } catch {
      if (type === "result") {
        setReadError("Clipboard access failed. Copy manually from the result field.")
      }
    }
  }

  const handleDownload = () => {
    if (!qrDataUrl || !deferredQrInput) {
      return
    }

    const link = document.createElement("a")
    link.href = qrDataUrl
    link.download = getFileName(deferredQrInput)
    link.click()
  }

  const handleStartCamera = async () => {
    if (!videoRef.current) {
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not support camera scanning.")
      return
    }

    stopScanner()
    setCameraError("")
    setReadError("")
    setReadStatus("Opening the camera…")

    const scanner = createScanner(
      videoRef.current,
      (result) => handleScanResult(result.data),
      () => {
        setReadStatus("Looking for a QR code…")
      },
    )

    scannerRef.current = scanner

    try {
      await scanner.start()
      setIsScanning(true)
      setReadStatus("Camera active. Point it at a QR code.")
    } catch (error) {
      scanner.destroy()
      scannerRef.current = null
      setIsScanning(false)
      setCameraError(getCameraErrorMessage(error))
      setReadStatus("Camera scanning is unavailable.")
    }
  }

  const handlePickImage = () => {
    setReadError("")
    fileInputRef.current?.click()
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      setReadError("Choose an image file that contains a QR code.")
      return
    }

    setIsUploading(true)
    setReadError("")
    setCameraError("")
    setFileName(file.name)
    setReadStatus("Decoding image…")

    try {
      const result = await scanQrImage(file)
      handleScanResult(result)
    } catch {
      setReadResult("")
      setReadError("No QR code could be read from that image.")
      setReadStatus("Upload another image or try the live camera scanner.")
    } finally {
      setIsUploading(false)
    }
  }

  const shareUrl = typeof window === "undefined" ? "" : window.location.href
  const createHasValue = Boolean(qrInput.trim())
  const readHasUrl = isProbablyUrl(readResult)

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.04),_transparent_42%),linear-gradient(180deg,_#fcfcfb_0%,_#f5f3ef_100%)] px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <div className="theme mx-auto flex w-full max-w-5xl flex-col gap-5">
        <section className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.24em]">
                Browser only
              </Badge>
              <div className="space-y-1">
                <h1 className="font-heading text-3xl leading-tight font-medium tracking-[-0.04em] sm:text-4xl">
                  QR tools without a backend
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                  Generate a shareable QR code instantly, then scan codes from your camera or local images without
                  sending data anywhere.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-stone-50 px-4 py-3 text-xs text-muted-foreground sm:max-w-64">
              Everything runs locally in your browser. No server uploads. No external file processing.
            </div>
          </div>
        </section>

        <Tabs value={tab} onValueChange={handleTabChange} className="gap-4">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-white/85 p-1 shadow-sm ring-1 ring-black/5">
            <TabsTrigger value="create" className="rounded-xl" aria-label="Create QR">
              <QrCode className="size-4" />
              Create QR
            </TabsTrigger>
            <TabsTrigger value="read" className="rounded-xl" aria-label="Read QR">
              <ScanLine className="size-4" />
              Read QR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <Card className="rounded-[24px] border-white/70 bg-white/88 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
                <CardHeader>
                  <CardTitle>Create QR</CardTitle>
                  <CardDescription>
                    Paste text or a URL. The QR image updates instantly and the page URL mirrors the current input.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="qr-input">Text or URL</Label>
                      {createHasValue ? (
                        <Badge variant="outline" className="rounded-full">
                          {isProbablyUrl(qrInput.trim()) ? "URL" : "Text"}
                        </Badge>
                      ) : null}
                    </div>
                    <Textarea
                      id="qr-input"
                      value={qrInput}
                      onChange={(event) => setQrInput(event.target.value)}
                      placeholder="https://example.com or any text"
                      className="min-h-40 rounded-2xl bg-stone-50/90 text-base shadow-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Share the current page URL and the same QR code will regenerate for anyone who opens it.
                    </p>
                  </div>

                  {!createHasValue ? (
                    <Alert>
                      <AlertCircle className="size-4" />
                      <AlertTitle>Enter something to generate a QR code</AlertTitle>
                      <AlertDescription>The QR image and shareable link will appear as soon as you type.</AlertDescription>
                    </Alert>
                  ) : null}
                </CardContent>
                <CardFooter className="flex flex-wrap justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => handleCopy(shareUrl, "link")}
                    disabled={!createHasValue}
                  >
                    {copyState === "link" ? <Check className="size-4" /> : <Link2 className="size-4" />}
                    {copyState === "link" ? "Link copied" : "Copy link"}
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => handleCopy(qrInput, "text")}
                      disabled={!createHasValue}
                    >
                      {copyState === "text" ? <Check className="size-4" /> : <Copy className="size-4" />}
                      {copyState === "text" ? "Copied" : "Copy text"}
                    </Button>
                    <Button type="button" className="rounded-xl" onClick={handleDownload} disabled={!qrDataUrl}>
                      <Download className="size-4" />
                      Download PNG
                    </Button>
                  </div>
                </CardFooter>
              </Card>

              <Card className="rounded-[24px] border-white/70 bg-[#111111] text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
                <CardHeader>
                  <CardTitle className="text-white">Preview</CardTitle>
                  <CardDescription className="text-white/65">
                    High-contrast PNG output sized for sharing, printing, or saving to photos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <div className="flex min-h-[296px] w-full items-center justify-center rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.08),_rgba(255,255,255,0.03))] p-6">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`Generated QR code for ${deferredQrInput}`}
                        className="aspect-square w-full max-w-[280px] rounded-[24px] bg-white p-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
                      />
                    ) : (
                      <div className="flex max-w-56 flex-col items-center gap-3 text-center text-sm text-white/70">
                        {isGenerating ? <RefreshCw className="size-6 animate-spin" /> : <QrCode className="size-7" />}
                        <p>{isGenerating ? "Generating QR image…" : "Your QR code preview will appear here."}</p>
                      </div>
                    )}
                  </div>

                  <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/72">
                    <div className="mb-1 font-medium text-white">Share URL</div>
                    <div className="break-all">{createHasValue ? shareUrl : "Add text above to build a shareable link."}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="read">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
              <Card className="rounded-[24px] border-white/70 bg-white/88 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
                <CardHeader>
                  <CardTitle>Read QR</CardTitle>
                  <CardDescription>
                    Scan with the rear camera or decode a QR code from a local image file.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-hidden rounded-[28px] border border-black/5 bg-stone-950">
                    <div className="aspect-square w-full">
                      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <Button type="button" className="rounded-xl" onClick={handleStartCamera} disabled={isScanning}>
                      <Camera className="size-4" />
                      {isScanning ? "Camera live" : "Start camera"}
                    </Button>
                    <Button type="button" variant="outline" className="rounded-xl" onClick={stopScanner} disabled={!isScanning}>
                      <Square className="size-4" />
                      Stop camera
                    </Button>
                    <Button type="button" variant="outline" className="rounded-xl" onClick={handlePickImage} disabled={isUploading}>
                      <ImageUp className="size-4" />
                      {isUploading ? "Reading image…" : "Upload image"}
                    </Button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    aria-label="Upload QR image"
                    onChange={handleImageUpload}
                  />

                  <div className="rounded-2xl border border-dashed border-black/10 bg-stone-50 px-4 py-3 text-sm text-muted-foreground">
                    {readStatus}
                    {fileName ? <span className="block pt-1 text-xs">Last image: {fileName}</span> : null}
                  </div>

                  {cameraError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertTitle>Camera unavailable</AlertTitle>
                      <AlertDescription>{cameraError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {readError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertTitle>Could not decode QR code</AlertTitle>
                      <AlertDescription>{readError}</AlertDescription>
                    </Alert>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="rounded-[24px] border-white/70 bg-white/88 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
                <CardHeader>
                  <CardTitle>Decoded result</CardTitle>
                  <CardDescription>
                    Copy the decoded value, or open it directly if it is a standard web URL.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="decoded-result">Result</Label>
                    <Input
                      id="decoded-result"
                      value={readResult}
                      readOnly
                      placeholder="Decoded content will appear here"
                      className="h-12 rounded-2xl bg-stone-50/90 shadow-none"
                    />
                  </div>

                  {readHasUrl ? (
                    <Alert>
                      <ExternalLink className="size-4" />
                      <AlertTitle>Looks like a web link</AlertTitle>
                      <AlertDescription>Use Open link to visit the decoded URL in a new tab.</AlertDescription>
                    </Alert>
                  ) : null}
                </CardContent>
                <CardFooter className="flex flex-wrap justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => handleCopy(readResult, "result")}
                    disabled={!readResult}
                  >
                    {copyState === "result" ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copyState === "result" ? "Copied" : "Copy result"}
                  </Button>
                  <Button type="button" className="rounded-xl" asChild={readHasUrl} disabled={!readHasUrl}>
                    {readHasUrl ? (
                      <a href={readResult} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" />
                        Open link
                      </a>
                    ) : (
                      <span>
                        <ExternalLink className="size-4" />
                        Open link
                      </span>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

export default App
