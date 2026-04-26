import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState } from "react"
import { LoaderCircle } from "lucide-react"

import { useSend } from "@/hooks/use-send"
import { useUtxos } from "@/hooks/use-utxos"
import { useWallet } from "@/hooks/use-wallet"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

const sendSchema = z.object({
  to: z.string().trim().min(1, "Destination address is required"),
  amountSats: z.number().int().positive("Amount must be positive"),
  feeRate: z.number().positive("Fee rate must be positive"),
})

type SendFormValues = z.infer<typeof sendSchema>

function formatSats(value: bigint | number): string {
  return BigInt(value).toLocaleString("en-US")
}

export function App() {
  const queryClient = useQueryClient()
  const { key, address } = useWallet()
  const { data, isLoading, isRefetching } = useUtxos()
  const sendMutation = useSend()
  const [draft, setDraft] = useState<SendFormValues | null>(null)
  const form = useForm<SendFormValues>({
    resolver: zodResolver(sendSchema),
    defaultValues: {
      to: "",
      amountSats: 0,
      feeRate: 1,
    },
  })

  const total = (data?.confirmed ?? 0n) + (data?.unconfirmed ?? 0n)

  async function confirmSend() {
    if (!draft) {
      return
    }

    try {
      const txid = await sendMutation.mutateAsync(draft)
      toast.success(`Broadcast complete: ${txid}`)
      setDraft(null)
      form.reset({
        to: "",
        amountSats: 0,
        feeRate: draft.feeRate,
      })
      await queryClient.invalidateQueries({ queryKey: ["utxos", address] })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Broadcast failed"
      toast.error(message)
    }
  }

  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_top,rgba(172,228,193,0.28),transparent_34%),linear-gradient(180deg,#f5f8ef_0%,#e7ece1_100%)] px-4 py-10 text-stone-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="grid gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-stone-600">
            Mutinynet Wallet
          </p>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-heading text-4xl font-semibold tracking-tight">
                Single-key demo wallet
              </h1>
              <p className="max-w-2xl text-sm text-stone-600">
                Receive on one `tb1q...` address and send with a signed PSBT.
                No encryption, no passphrase, no QR.
              </p>
            </div>
            <div className="rounded-2xl border border-stone-900/10 bg-white/70 px-4 py-3 text-sm shadow-sm backdrop-blur">
              <div className="text-stone-500">Balance</div>
              <div className="text-2xl font-semibold">
                {formatSats(total)} sats
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border border-stone-900/10 bg-white/80 shadow-xl shadow-stone-900/5 backdrop-blur">
            <CardHeader>
              <CardTitle>Receive</CardTitle>
              <CardDescription>
                Funds arrive on a single native SegWit Mutinynet address.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="rounded-2xl border border-dashed border-stone-900/15 bg-stone-50/80 p-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-stone-500">
                  Address
                </div>
                <code className="block overflow-x-auto text-sm text-stone-800">
                  {address ?? "Generating wallet..."}
                </code>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-stone-950 px-4 py-4 text-stone-50">
                  <div className="text-xs uppercase tracking-[0.24em] text-stone-400">
                    Confirmed
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {formatSats(data?.confirmed ?? 0n)}
                  </div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-stone-900/10">
                  <div className="text-xs uppercase tracking-[0.24em] text-stone-500">
                    Unconfirmed
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {formatSats(data?.unconfirmed ?? 0n)}
                  </div>
                </div>
              </div>

              <div className="grid gap-2 text-sm text-stone-600">
                <div>Wallet key: {key ? "stored in localStorage" : "pending"}</div>
                <div>Polling: every 15 seconds</div>
                <div>
                  Status:{" "}
                  {isLoading
                    ? "loading"
                    : isRefetching
                      ? "refreshing"
                      : `${data?.utxos.length ?? 0} UTXO(s)`}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-stone-900/10 bg-white/85 shadow-xl shadow-stone-900/5 backdrop-blur">
            <CardHeader>
              <CardTitle>Send</CardTitle>
              <CardDescription>
                Build, sign, finalize, and broadcast a P2WPKH spend.
              </CardDescription>
            </CardHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) => setDraft(values))}
                className="contents"
              >
                <CardContent className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Destination</FormLabel>
                        <FormControl>
                          <Input placeholder="tb1q..." {...field} />
                        </FormControl>
                        <FormDescription>
                          Only testnet-format `tb1...` addresses are accepted.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="amountSats"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (sats)</FormLabel>
                        <FormControl>
                          <Input
                            inputMode="numeric"
                            type="number"
                            min="1"
                            value={Number.isNaN(field.value) ? "" : field.value}
                            onChange={(event) =>
                              field.onChange(event.target.valueAsNumber)
                            }
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="feeRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fee rate (sat/vB)</FormLabel>
                        <FormControl>
                          <Input
                            inputMode="decimal"
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={Number.isNaN(field.value) ? "" : field.value}
                            onChange={(event) =>
                              field.onChange(event.target.valueAsNumber)
                            }
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="justify-between gap-3">
                  <p className="text-sm text-stone-500">
                    A confirmation dialog appears before broadcast.
                  </p>
                  <Button
                    type="submit"
                    disabled={!address || sendMutation.isPending}
                    className="min-w-28"
                  >
                    {sendMutation.isPending ? (
                      <LoaderCircle className="animate-spin" />
                    ) : null}
                    Send
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </div>
      </div>

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Broadcast transaction?</DialogTitle>
            <DialogDescription>
              The wallet will fetch UTXOs, build a PSBT, sign it with the local
              key, finalize inputs, and post raw hex to the backend.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 rounded-2xl bg-stone-100 p-4 text-sm text-stone-700">
            <div>From: {address ?? "Wallet not ready"}</div>
            <div>To: {draft?.to}</div>
            <div>Amount: {draft ? formatSats(draft.amountSats) : 0} sats</div>
            <div>Fee rate: {draft?.feeRate ?? 0} sat/vB</div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDraft(null)}
              disabled={sendMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={confirmSend} disabled={sendMutation.isPending}>
              Confirm broadcast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App
