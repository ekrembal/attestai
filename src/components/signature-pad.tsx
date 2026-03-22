import * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type SignaturePadProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultName: string
  onPlaceSignature: (dataUrl: string, shouldSave: boolean, label: string) => void
}

type Point = {
  x: number
  y: number
}

function getPoint(
  event: PointerEvent | React.PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement
): Point {
  const rect = canvas.getBoundingClientRect()

  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  }
}

export function SignaturePad({
  open,
  onOpenChange,
  defaultName,
  onPlaceSignature,
}: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const drawingRef = React.useRef(false)
  const pointRef = React.useRef<Point | null>(null)
  const [label, setLabel] = React.useState(defaultName)
  const [error, setError] = React.useState<string | null>(null)
  const [hasInk, setHasInk] = React.useState(false)

  const resetCanvas = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext("2d")
    if (!context) {
      return
    }

    const ratio = window.devicePixelRatio || 1
    canvas.width = 640 * ratio
    canvas.height = 220 * ratio
    canvas.style.width = "100%"
    canvas.style.height = "220px"

    context.setTransform(1, 0, 0, 1, 0, 0)
    context.scale(ratio, ratio)
    context.clearRect(0, 0, 640, 220)
    context.lineCap = "round"
    context.lineJoin = "round"
    context.lineWidth = 2.8
    context.strokeStyle = "#162224"
    setHasInk(false)
    pointRef.current = null
  }, [])

  React.useEffect(() => {
    if (!open) {
      return
    }

    setLabel(defaultName)
    setError(null)
    window.requestAnimationFrame(() => {
      resetCanvas()
    })
  }, [defaultName, open, resetCanvas])

  const drawTo = React.useCallback((point: Point) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext("2d")
    if (!context) {
      return
    }

    const previous = pointRef.current
    if (!previous) {
      context.beginPath()
      context.arc(point.x, point.y, 1.4, 0, Math.PI * 2)
      context.fillStyle = "#162224"
      context.fill()
      pointRef.current = point
      setHasInk(true)
      return
    }

    context.beginPath()
    context.moveTo(previous.x, previous.y)
    context.lineTo(point.x, point.y)
    context.stroke()
    pointRef.current = point
    setHasInk(true)
  }, [])

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    canvas.setPointerCapture(event.pointerId)
    drawingRef.current = true
    setError(null)
    drawTo(getPoint(event, canvas))
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !drawingRef.current) {
      return
    }

    drawTo(getPoint(event, canvas))
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (canvas && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }

    drawingRef.current = false
    pointRef.current = null
  }

  const handlePlace = (shouldSave: boolean) => {
    const canvas = canvasRef.current
    if (!canvas || !hasInk) {
      setError("Add a signature before placing it on the document.")
      return
    }

    onPlaceSignature(canvas.toDataURL("image/png"), shouldSave, label.trim())
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Draw signature</DialogTitle>
          <DialogDescription>
            Draw directly in the browser. You can place it once or save it in
            local storage for reuse.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signature-name">Saved signature label</Label>
            <Input
              id="signature-name"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="My signature"
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Signature required</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-border bg-[#fffdf7]">
            <canvas
              ref={canvasRef}
              className="touch-none"
              data-testid="signature-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={resetCanvas}>
            Clear
          </Button>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => handlePlace(false)}>
              Place once
            </Button>
            <Button type="button" onClick={() => handlePlace(true)}>
              Save & place
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
