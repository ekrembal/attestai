import { useRef, useState } from "react"
import { Upload, FolderOpen } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type FileDropzoneProps = {
  multiple?: boolean
  disabled?: boolean
  title: string
  description: string
  onFiles: (files: File[]) => void | Promise<void>
}

export function FileDropzone({
  multiple = false,
  disabled = false,
  title,
  description,
  onFiles,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  async function handleFileList(fileList: FileList | null) {
    if (!fileList?.length || disabled) {
      return
    }

    await onFiles(Array.from(fileList).filter((file) => file.type === "application/pdf"))
  }

  return (
    <Card
      className={cn(
        "border-dashed bg-card/70 backdrop-blur-sm transition-colors",
        isDragging && "border-primary/50 bg-primary/5"
      )}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <button
          type="button"
          data-testid="file-dropzone"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            setIsDragging(false)
          }}
          onDrop={async (event) => {
            event.preventDefault()
            setIsDragging(false)
            await handleFileList(event.dataTransfer.files)
          }}
          className="flex min-h-52 w-full flex-col items-center justify-center rounded-xl border border-border/70 bg-background/70 px-6 py-8 text-center transition-colors hover:bg-muted/60"
        >
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Upload className="size-6" />
          </div>
          <div className="space-y-2">
            <p className="text-base font-medium">Drop PDF files here</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Files stay in your browser. Nothing is uploaded to a server.
            </p>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground shadow-sm">
              <FolderOpen />
              Browse files
            </span>
            <span className="text-xs text-muted-foreground">
              {multiple ? "Multiple PDFs supported" : "Single PDF"}
            </span>
          </div>
        </button>
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="application/pdf"
          multiple={multiple}
          onChange={async (event) => {
            await handleFileList(event.target.files)
            event.target.value = ""
          }}
        />
      </CardContent>
    </Card>
  )
}
