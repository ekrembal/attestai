import { startTransition, useEffect, useState } from "react"

import {
  deriveP2wpkhAddress,
  generatePrivateKeyHex,
} from "@/lib/wallet/address"
import { MUTINY_WALLET_KEY } from "@/lib/wallet/constants"

type WalletState = {
  key: string | null
  address: string | null
}

export function useWallet(): WalletState {
  const [wallet, setWallet] = useState<WalletState>({ key: null, address: null })

  useEffect(() => {
    startTransition(() => {
      const stored =
        window.localStorage.getItem(MUTINY_WALLET_KEY) ??
        generatePrivateKeyHex((bytes) => crypto.getRandomValues(bytes))

      window.localStorage.setItem(MUTINY_WALLET_KEY, stored)

      setWallet({
        key: stored,
        address: deriveP2wpkhAddress(stored),
      })
    })
  }, [])

  return wallet
}
