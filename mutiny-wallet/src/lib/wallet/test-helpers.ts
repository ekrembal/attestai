import type { EsploraClient, EsploraUtxo } from "@/lib/api/esplora"
import { deriveP2wpkhAddress, scriptPubKeyFor } from "@/lib/wallet/address"
import type { WalletUtxo } from "@/lib/wallet/types"

export const FIXED_PRIVATE_KEY_HEX =
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
export const WRONG_PRIVATE_KEY_HEX =
  "1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100"

export const FIXED_ADDRESS = deriveP2wpkhAddress(FIXED_PRIVATE_KEY_HEX)
export const RECIPIENT_ADDRESS = deriveP2wpkhAddress(WRONG_PRIVATE_KEY_HEX)

export function makeWalletUtxo(
  valueSats: bigint,
  txid: string,
  vout: number,
  address = FIXED_ADDRESS
): WalletUtxo {
  return {
    txid,
    vout,
    valueSats,
    scriptPubKey: scriptPubKeyFor(address),
    status: { confirmed: true },
  }
}

export class FakeEsploraClient implements EsploraClient {
  public readonly utxos: EsploraUtxo[]
  public broadcastCalls = 0
  public lastBroadcastHex: string | null = null
  public utxoFetches = 0

  constructor(utxos: EsploraUtxo[]) {
    this.utxos = utxos
  }

  async getAddressInfo() {
    return {
      address: FIXED_ADDRESS,
      chain_stats: {
        funded_txo_count: 0,
        funded_txo_sum: 0,
        spent_txo_count: 0,
        spent_txo_sum: 0,
        tx_count: 0,
      },
      mempool_stats: {
        funded_txo_count: 0,
        funded_txo_sum: 0,
        spent_txo_count: 0,
        spent_txo_sum: 0,
        tx_count: 0,
      },
    }
  }

  async getAddressUtxos() {
    this.utxoFetches += 1
    return this.utxos
  }

  async broadcastTx(txHex: string) {
    this.broadcastCalls += 1
    this.lastBroadcastHex = txHex
    return "broadcasted"
  }
}
