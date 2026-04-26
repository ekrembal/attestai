import type { UtxoStatus } from "@/lib/api/schema"
import type { EsploraUtxo } from "@/lib/api/esplora"

export type WalletUtxo = {
  txid: string
  vout: number
  valueSats: bigint
  scriptPubKey: string
  status: UtxoStatus
}

export type WalletBalance = {
  confirmed: bigint
  unconfirmed: bigint
}

export function toWalletUtxo(
  utxo: EsploraUtxo,
  scriptPubKey: string
): WalletUtxo {
  return {
    txid: utxo.txid,
    vout: utxo.vout,
    valueSats: BigInt(utxo.value),
    scriptPubKey,
    status: utxo.status,
  }
}
