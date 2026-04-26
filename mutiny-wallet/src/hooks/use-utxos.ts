import { useQuery } from "@tanstack/react-query"

import { createEsploraClient } from "@/lib/api/esplora"
import { scriptPubKeyFor } from "@/lib/wallet/address"
import { MUTINY_BACKEND_URL } from "@/lib/wallet/constants"
import { toWalletUtxo } from "@/lib/wallet/types"
import { useWallet } from "@/hooks/use-wallet"

const esploraClient = createEsploraClient(MUTINY_BACKEND_URL)

export function useUtxos() {
  const { address } = useWallet()

  return useQuery({
    queryKey: ["utxos", address],
    enabled: Boolean(address),
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!address) {
        return {
          utxos: [],
          confirmed: 0n,
          unconfirmed: 0n,
        }
      }

      const scriptPubKey = scriptPubKeyFor(address)
      const utxos = (await esploraClient.getAddressUtxos(address)).map((utxo) =>
        toWalletUtxo(utxo, scriptPubKey)
      )

      const confirmed = utxos
        .filter((utxo) => utxo.status.confirmed)
        .reduce((sum, utxo) => sum + utxo.valueSats, 0n)
      const unconfirmed = utxos
        .filter((utxo) => !utxo.status.confirmed)
        .reduce((sum, utxo) => sum + utxo.valueSats, 0n)

      return {
        utxos,
        confirmed,
        unconfirmed,
      }
    },
  })
}
