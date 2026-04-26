import { useMutation } from "@tanstack/react-query"

import { createEsploraClient } from "@/lib/api/esplora"
import { sendTransaction } from "@/lib/wallet/send"
import { MUTINY_BACKEND_URL } from "@/lib/wallet/constants"
import { useWallet } from "@/hooks/use-wallet"

const esploraClient = createEsploraClient(MUTINY_BACKEND_URL)

export function useSend() {
  const { key, address } = useWallet()

  return useMutation({
    mutationFn: async (params: {
      to: string
      amountSats: number
      feeRate: number
    }) => {
      if (!key || !address) {
        throw new Error("Wallet not ready")
      }

      return sendTransaction({
        client: esploraClient,
        keyHex: key,
        fromAddress: address,
        to: params.to,
        amountSats: BigInt(params.amountSats),
        feeRate: params.feeRate,
      })
    },
  })
}
