import { useMemo, useState } from "react"
import {
  AlertCircle,
  BadgeCheck,
  FileDown,
  FileImage,
  FileText,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  createPassportPhoto,
  loadImageMetrics,
  type ImageMetrics,
  type ImageProcessResult,
} from "@/lib/image-processing"
import { compressImageToTarget } from "@/lib/image-processing"
import type { PdfProcessResult } from "@/lib/pdf-processing"
import { cn } from "@/lib/utils"

type ToolStatus = {
  tone: "default" | "success" | "warning" | "error"
  title: string
  detail: string
}

type DownloadableResult = {
  blob: Blob
  fileName: string
}

const PDF_DEFAULT_TARGET_KB = 1024
const IMAGE_DEFAULT_TARGET_KB = 2048
const PASSPORT_DEFAULT_TARGET_KB = 240

function formatBytes(bytes: number) {
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

function formatPercent(before: number, after: number) {
  if (before <= 0) {
    return "0%"
  }

  return `${Math.max(0, ((before - after) / before) * 100).toFixed(0)}%`
}

function buildDownloadedName(fileName: string, suffix: string, extension: string) {
  const base = fileName.replace(/\.[^.]+$/, "")
  return `${base}-${suffix}.${extension}`
}

function triggerDownload(result: DownloadableResult) {
  const url = URL.createObjectURL(result.blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = result.fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function getStatusClasses(tone: ToolStatus["tone"]) {
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
  }

  if (tone === "error") {
    return "border-red-200 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
  }

  return "border-border bg-card"
}

function App() {
  const [pdfTargetKb, setPdfTargetKb] = useState(PDF_DEFAULT_TARGET_KB)
  const [pdfStatus, setPdfStatus] = useState<ToolStatus>({
    tone: "default",
    title: "PDFs stay on this device",
    detail: "We render and rebuild the file locally in your browser. Nothing is uploaded anywhere.",
  })
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfProgress, setPdfProgress] = useState(0)
  const [pdfSummary, setPdfSummary] = useState<PdfProcessResult | null>(null)

  const [imageTargetKb, setImageTargetKb] = useState(IMAGE_DEFAULT_TARGET_KB)
  const [imageStatus, setImageStatus] = useState<ToolStatus>({
    tone: "default",
    title: "Image optimizer ready",
    detail: "Choose a photo or scan, set a target limit, and get a smaller browser-generated copy.",
  })
  const [imageBusy, setImageBusy] = useState(false)
  const [imageSummary, setImageSummary] = useState<ImageProcessResult | null>(
    null
  )

  const [passportTargetKb, setPassportTargetKb] = useState(
    PASSPORT_DEFAULT_TARGET_KB
  )
  const [passportOutputSize, setPassportOutputSize] = useState("600")
  const [passportStatus, setPassportStatus] = useState<ToolStatus>({
    tone: "default",
    title: "Passport photo checker",
    detail: "Checks whether the image is square and in the common 600 to 1200 px passport range, then can normalize it.",
  })
  const [passportBusy, setPassportBusy] = useState(false)
  const [passportMetrics, setPassportMetrics] = useState<ImageMetrics | null>(
    null
  )
  const [passportSummary, setPassportSummary] =
    useState<ImageProcessResult | null>(null)

  const passportChecks = useMemo(() => {
    if (!passportMetrics) {
      return null
    }

    const ratio = passportMetrics.width / passportMetrics.height
    const square = ratio >= 0.98 && ratio <= 1.02
    const rangeOk =
      passportMetrics.width >= 600 &&
      passportMetrics.height >= 600 &&
      passportMetrics.width <= 1200 &&
      passportMetrics.height <= 1200

    return {
      square,
      rangeOk,
      ratio,
      passes: square && rangeOk,
    }
  }, [passportMetrics])

  async function handlePdfFile(file: File | null) {
    setPdfSummary(null)
    setPdfProgress(0)

    if (!file) {
      return
    }

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setPdfStatus({
        tone: "error",
        title: "Unsupported file",
        detail: "Choose a PDF file for this tool.",
      })
      return
    }

    setPdfBusy(true)
    setPdfStatus({
      tone: "default",
      title: "Compressing PDF",
      detail: "Rendering pages locally and testing several compression levels.",
    })

    try {
      const { compressPdfToTarget } = await import("@/lib/pdf-processing")
      const result = await compressPdfToTarget(file, pdfTargetKb * 1024, (value) =>
        setPdfProgress(value)
      )
      setPdfSummary(result)
      setPdfStatus({
        tone: result.passed ? "success" : "warning",
        title: result.passed
          ? "Target reached"
          : "Best effort complete",
        detail: result.message,
      })
    } catch (error) {
      setPdfStatus({
        tone: "error",
        title: "PDF processing failed",
        detail:
          error instanceof Error
            ? error.message
            : "The PDF could not be processed in the browser.",
      })
    } finally {
      setPdfBusy(false)
    }
  }

  async function handleImageFile(file: File | null) {
    setImageSummary(null)

    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      setImageStatus({
        tone: "error",
        title: "Unsupported file",
        detail: "Choose a JPG, PNG, or WebP image for this tool.",
      })
      return
    }

    setImageBusy(true)
    setImageStatus({
      tone: "default",
      title: "Optimizing image",
      detail: "Testing a series of browser-side resize and quality settings.",
    })

    try {
      const result = await compressImageToTarget(file, imageTargetKb * 1024)
      setImageSummary(result)
      setImageStatus({
        tone: result.passed ? "success" : "warning",
        title: result.passed ? "Image is under the limit" : "Closest result ready",
        detail: result.message,
      })
    } catch (error) {
      setImageStatus({
        tone: "error",
        title: "Image processing failed",
        detail:
          error instanceof Error
            ? error.message
            : "The image could not be processed in the browser.",
      })
    } finally {
      setImageBusy(false)
    }
  }

  async function handlePassportFile(file: File | null) {
    setPassportSummary(null)
    setPassportMetrics(null)

    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      setPassportStatus({
        tone: "error",
        title: "Unsupported file",
        detail: "Choose an image file for passport photo checking.",
      })
      return
    }

    setPassportBusy(true)
    setPassportStatus({
      tone: "default",
      title: "Checking photo",
      detail: "Reading dimensions and preparing a normalized square export.",
    })

    try {
      const metrics = await loadImageMetrics(file)
      setPassportMetrics(metrics)

      const result = await createPassportPhoto(
        file,
        Number(passportOutputSize),
        passportTargetKb * 1024
      )
      setPassportSummary(result)
      setPassportStatus({
        tone: result.passed ? "success" : "warning",
        title: result.passed
          ? "Passport-ready export created"
          : "Photo resized but still over the chosen limit",
        detail: result.message,
      })
    } catch (error) {
      setPassportStatus({
        tone: "error",
        title: "Passport photo processing failed",
        detail:
          error instanceof Error
            ? error.message
            : "The passport photo could not be processed in the browser.",
      })
    } finally {
      setPassportBusy(false)
    }
  }

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.92),_transparent_40%),linear-gradient(180deg,_rgba(242,247,244,1)_0%,_rgba(248,245,239,1)_42%,_rgba(253,251,248,1)_100%)] px-4 py-5 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Card className="overflow-hidden border-white/70 bg-white/80 shadow-lg backdrop-blur dark:border-white/10 dark:bg-card/85">
          <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  Browser-only
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  No uploads
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  Mobile friendly
                </Badge>
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
                  Hit common upload limits without sending your files anywhere.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Pick a goal like PDF under 1 MB, image under 2 MB, or passport
                  photo sizing. The app checks the result against your chosen
                  limit and gives you a ready-to-download file when possible.
                </p>
              </div>
            </div>
            <div className="grid gap-3 rounded-3xl border border-border/70 bg-background/70 p-4">
              <QuickStat
                label="Local processing"
                value="100%"
                detail="Files stay in your browser tab"
              />
              <QuickStat
                label="Typical goals"
                value="3"
                detail="PDF, image, passport photo"
              />
              <QuickStat
                label="Feedback"
                value="Before / after"
                detail="Clear pass-or-fail status"
              />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="pdf" className="space-y-4">
          <TabsList className="grid h-auto grid-cols-3 rounded-2xl bg-card/80 p-1 shadow-sm backdrop-blur">
            <TabsTrigger value="pdf" className="rounded-xl py-3">
              <FileText className="mr-2 size-4" />
              PDF
            </TabsTrigger>
            <TabsTrigger value="image" className="rounded-xl py-3">
              <FileImage className="mr-2 size-4" />
              Image
            </TabsTrigger>
            <TabsTrigger value="passport" className="rounded-xl py-3">
              <ShieldCheck className="mr-2 size-4" />
              Passport
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pdf">
            <ToolLayout
              title="Compress PDF to under your chosen limit"
              description="Best for application forms, statements, and scans that need a smaller browser-generated copy."
              status={pdfStatus}
            >
              <TargetInput
                id="pdf-target"
                label="Target limit (KB)"
                value={pdfTargetKb}
                onChange={setPdfTargetKb}
                min={100}
                max={4096}
              />
              <FilePicker
                id="pdf-file"
                label="PDF file"
                accept=".pdf,application/pdf"
                disabled={pdfBusy}
                onSelect={handlePdfFile}
              />
              <BusyRow busy={pdfBusy} progress={pdfProgress} />
              <ResultCard
                result={pdfSummary}
                downloadLabel="Download compressed PDF"
                onDownload={() =>
                  pdfSummary &&
                  triggerDownload({
                    blob: pdfSummary.blob,
                    fileName: buildDownloadedName(
                      pdfSummary.fileName,
                      "compressed",
                      "pdf"
                    ),
                  })
                }
              />
            </ToolLayout>
          </TabsContent>

          <TabsContent value="image">
            <ToolLayout
              title="Compress image to under your chosen limit"
              description="Useful for portal uploads that reject oversized photos or screenshots."
              status={imageStatus}
            >
              <TargetInput
                id="image-target"
                label="Target limit (KB)"
                value={imageTargetKb}
                onChange={setImageTargetKb}
                min={50}
                max={8192}
              />
              <FilePicker
                id="image-file"
                label="Image file"
                accept="image/jpeg,image/png,image/webp"
                disabled={imageBusy}
                onSelect={handleImageFile}
              />
              <BusyRow busy={imageBusy} progress={85} />
              <ResultCard
                result={imageSummary}
                downloadLabel="Download optimized image"
                onDownload={() =>
                  imageSummary &&
                  triggerDownload({
                    blob: imageSummary.blob,
                    fileName: buildDownloadedName(
                      imageSummary.fileName,
                      "compressed",
                      "jpg"
                    ),
                  })
                }
              />
            </ToolLayout>
          </TabsContent>

          <TabsContent value="passport">
            <ToolLayout
              title="Check and resize a passport photo"
              description="Checks for a square image in the common 600 to 1200 px range, then makes a centered square export."
              status={passportStatus}
            >
              <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                <div className="grid gap-4">
                  <TargetInput
                    id="passport-target"
                    label="Target limit (KB)"
                    value={passportTargetKb}
                    onChange={setPassportTargetKb}
                    min={50}
                    max={1024}
                  />
                  <Card className="border-dashed bg-muted/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        Output size
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RadioGroup
                        value={passportOutputSize}
                        onValueChange={setPassportOutputSize}
                        className="grid gap-3"
                      >
                        {[
                          {
                            value: "600",
                            label: "600 × 600 px",
                            hint: "Safe baseline for common online passport uploads.",
                          },
                          {
                            value: "1200",
                            label: "1200 × 1200 px",
                            hint: "Higher detail when a portal accepts larger passport images.",
                          },
                        ].map((option) => (
                          <label
                            key={option.value}
                            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-3"
                          >
                            <RadioGroupItem value={option.value} id={option.value} />
                            <div className="grid gap-1">
                              <span className="font-medium">{option.label}</span>
                              <span className="text-sm text-muted-foreground">
                                {option.hint}
                              </span>
                            </div>
                          </label>
                        ))}
                      </RadioGroup>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4">
                  <FilePicker
                    id="passport-file"
                    label="Photo file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={passportBusy}
                    onSelect={handlePassportFile}
                  />
                  <BusyRow busy={passportBusy} progress={80} />
                  <PassportChecks checks={passportChecks} metrics={passportMetrics} />
                </div>
              </div>

              <Separator />

              <ResultCard
                result={passportSummary}
                downloadLabel="Download passport-ready image"
                onDownload={() =>
                  passportSummary &&
                  triggerDownload({
                    blob: passportSummary.blob,
                    fileName: buildDownloadedName(
                      passportSummary.fileName,
                      `passport-${passportOutputSize}`,
                      "jpg"
                    ),
                  })
                }
              />
            </ToolLayout>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

function QuickStat({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function ToolLayout({
  title,
  description,
  status,
  children,
}: {
  title: string
  description: string
  status: ToolStatus
  children: React.ReactNode
}) {
  return (
    <Card className="border-white/70 bg-white/85 shadow-lg backdrop-blur dark:border-white/10 dark:bg-card/90">
      <CardHeader className="space-y-3">
        <div className="space-y-1">
          <CardTitle className="text-xl">{title}</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <Alert className={cn("rounded-2xl", getStatusClasses(status.tone))}>
          {status.tone === "error" ? (
            <AlertCircle className="size-4" />
          ) : status.tone === "success" ? (
            <BadgeCheck className="size-4" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
          <AlertTitle>{status.title}</AlertTitle>
          <AlertDescription>{status.detail}</AlertDescription>
        </Alert>
      </CardHeader>
      <CardContent className="grid gap-5">{children}</CardContent>
    </Card>
  )
}

function FilePicker({
  id,
  label,
  accept,
  disabled,
  onSelect,
}: {
  id: string
  label: string
  accept: string
  disabled?: boolean
  onSelect: (file: File | null) => void | Promise<void>
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          void onSelect(event.target.files?.[0] ?? null)
        }}
      />
      <p className="text-xs text-muted-foreground">
        File processing starts in your browser as soon as you choose a file.
      </p>
    </div>
  )
}

function TargetInput({
  id,
  label,
  value,
  onChange,
  min,
  max,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const nextValue = Number(event.target.value)
          if (Number.isFinite(nextValue)) {
            onChange(Math.min(max, Math.max(min, Math.round(nextValue))))
          }
        }}
      />
      <p className="text-xs text-muted-foreground">
        Current target: {formatBytes(value * 1024)}
      </p>
    </div>
  )
}

function BusyRow({ busy, progress }: { busy: boolean; progress: number }) {
  if (!busy) {
    return null
  }

  return (
    <div className="grid gap-2 rounded-2xl border border-dashed border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <LoaderCircle className="size-4 animate-spin" />
        Working in your browser
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  )
}

function PassportChecks({
  checks,
  metrics,
}: {
  checks: { square: boolean; rangeOk: boolean; ratio: number; passes: boolean } | null
  metrics: ImageMetrics | null
}) {
  return (
    <Card className="border-dashed bg-muted/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Photo check</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Current dimensions</span>
          <span>
            {metrics ? `${metrics.width} × ${metrics.height}px` : "No file yet"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Square enough</span>
          <StatusPill active={checks?.square ?? false} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Within 600 to 1200 px</span>
          <StatusPill active={checks?.rangeOk ?? false} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Aspect ratio</span>
          <span>{checks ? checks.ratio.toFixed(2) : "n/a"}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between font-medium">
          <span>Passport readiness</span>
          <StatusPill active={checks?.passes ?? false} />
        </div>
      </CardContent>
    </Card>
  )
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium",
        active
          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
          : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
      )}
    >
      {active ? "Pass" : "Needs attention"}
    </span>
  )
}

function ResultCard({
  result,
  downloadLabel,
  onDownload,
}: {
  result: (ImageProcessResult | PdfProcessResult) | null
  downloadLabel: string
  onDownload: () => void
}) {
  if (!result) {
    return (
      <Card className="border-dashed bg-muted/20">
        <CardContent className="flex min-h-36 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Processed files will show before and after sizes, pass status, and a
          download action here.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-3xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-4 text-base">
          <span>Result</span>
          <Badge variant={result.passed ? "default" : "secondary"}>
            {result.passed ? "Passes target" : "Still over target"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricTile label="Before" value={formatBytes(result.originalSize)} />
          <MetricTile label="After" value={formatBytes(result.outputSize)} />
          <MetricTile
            label="Reduction"
            value={formatPercent(result.originalSize, result.outputSize)}
          />
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{result.message}</p>
        <Button className="w-full sm:w-fit" onClick={onDownload}>
          <FileDown className="mr-2 size-4" />
          {downloadLabel}
        </Button>
      </CardContent>
    </Card>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  )
}

export default App
