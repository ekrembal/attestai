import type { LucideIcon } from "lucide-react"
import {
  Combine,
  FileDigit,
  FileText,
  Layers2,
  RotateCw,
  ScissorsLineDashed,
  Trash2,
} from "lucide-react"

export type ToolId =
  | "merge"
  | "split"
  | "reorder"
  | "rotate"
  | "delete"
  | "extract-pages"
  | "extract-text"

export type ToolDefinition = {
  id: ToolId
  title: string
  summary: string
  description: string
  icon: LucideIcon
  acceptsMultipleFiles: boolean
}

export const tools: ToolDefinition[] = [
  {
    id: "merge",
    title: "Merge PDFs",
    summary: "Combine multiple PDFs into a single file, then reorder before export.",
    description:
      "Bring multiple PDFs together in one browser-only workspace and publish a single merged export.",
    icon: Combine,
    acceptsMultipleFiles: true,
  },
  {
    id: "split",
    title: "Split PDF",
    summary: "Split one PDF into single pages or custom page groups.",
    description:
      "Create per-page files or package custom page ranges into a zip without sending anything off-device.",
    icon: ScissorsLineDashed,
    acceptsMultipleFiles: false,
  },
  {
    id: "reorder",
    title: "Reorder Pages",
    summary: "Drag pages into a new order and download the rebuilt PDF.",
    description:
      "Use drag and drop to reshape a document visually, then export the new page sequence.",
    icon: Layers2,
    acceptsMultipleFiles: false,
  },
  {
    id: "rotate",
    title: "Rotate Pages",
    summary: "Rotate selected pages left or right before exporting the updated document.",
    description:
      "Adjust page orientation in 90 degree increments and keep the rest of the document intact.",
    icon: RotateCw,
    acceptsMultipleFiles: false,
  },
  {
    id: "delete",
    title: "Delete Pages",
    summary: "Select unwanted pages and remove them from the output file.",
    description:
      "Trim a PDF down to the pages that matter, with visual confirmation before download.",
    icon: Trash2,
    acceptsMultipleFiles: false,
  },
  {
    id: "extract-pages",
    title: "Extract Pages",
    summary: "Select specific pages and export them into a new PDF.",
    description:
      "Pull the exact pages you need into a fresh document while preserving their order.",
    icon: FileDigit,
    acceptsMultipleFiles: false,
  },
  {
    id: "extract-text",
    title: "Extract Text",
    summary: "Read selectable text from a PDF and export it as plain text.",
    description:
      "Extract searchable text entirely in the browser, page by page or across the full document.",
    icon: FileText,
    acceptsMultipleFiles: false,
  },
]

export const toolById = new Map(tools.map((tool) => [tool.id, tool]))
