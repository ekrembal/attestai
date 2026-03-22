import { ArrowRight, ShieldCheck } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { tools } from "@/data/tools"
import { cn } from "@/lib/utils"

export function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.16),_transparent_26%),linear-gradient(180deg,_rgba(250,250,249,1),_rgba(245,245,244,1))]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 sm:px-8 lg:px-12">
        <header className="flex flex-col gap-8 rounded-[2rem] border border-white/70 bg-background/80 p-8 shadow-sm backdrop-blur md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  PDF Utils
                </p>
                <p className="text-sm text-muted-foreground">
                  Browser-only PDF toolkit
                </p>
              </div>
            </div>
            <Badge variant="outline" className="px-3 py-1 text-xs">
              Private by design
            </Badge>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-5">
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                Client-side only
              </Badge>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-foreground md:text-6xl">
                  Edit, split, merge, and extract PDFs without leaving the browser.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                  A fast single-page workspace built with React, TypeScript, Vite,
                  Tailwind, and shadcn/ui. Load files locally, manipulate pages visually,
                  and download the result immediately.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/tools/merge"
                  className={cn(buttonVariants({ variant: "default" }))}
                >
                  Launch workspace
                  <ArrowRight />
                </Link>
                <Link
                  to="/tools/extract-text"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Extract text
                </Link>
              </div>
            </div>

            <Card className="border-0 bg-zinc-950 text-zinc-50 shadow-xl shadow-zinc-950/10">
              <CardHeader>
                <CardTitle className="text-zinc-50">What it covers</CardTitle>
                <CardDescription className="text-zinc-300">
                  Core PDF operations with local processing and strong visual feedback.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  "Merge multiple PDFs into one output",
                  "Split into single pages or custom ranges",
                  "Drag to reorder pages with live thumbnails",
                  "Rotate, delete, or extract selected pages",
                  "Extract selectable text to plain text",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="mt-1 size-2 rounded-full bg-amber-400" />
                    <p className="text-sm leading-6 text-zinc-200">{item}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </header>

        <Separator className="my-10" />

        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Tools
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Choose a focused workflow
              </h2>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {tools.map((tool) => {
              const Icon = tool.icon

              return (
                <Card
                  key={tool.id}
                  className="border-white/70 bg-background/80 backdrop-blur transition-transform duration-200 hover:-translate-y-1"
                >
                  <CardHeader>
                    <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle>{tool.title}</CardTitle>
                    <CardDescription>{tool.summary}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {tool.description}
                    </p>
                  </CardContent>
                  <CardFooter className="justify-between">
                    <Badge variant="outline">
                      {tool.acceptsMultipleFiles ? "Multi-file" : "Single-file"}
                    </Badge>
                    <Link
                      to={`/tools/${tool.id}`}
                      className={cn(buttonVariants({ variant: "ghost" }))}
                    >
                      Open tool
                      <ArrowRight />
                    </Link>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}
