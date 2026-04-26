export type AddressStats = {
  funded_txo_count: number
  funded_txo_sum: number
  spent_txo_count: number
  spent_txo_sum: number
  tx_count: number
}

export type AddressInfoResponse = {
  address: string
  chain_stats: AddressStats
  mempool_stats: AddressStats
}

export type UtxoStatus = {
  confirmed: boolean
  block_height?: number
  block_hash?: string
  block_time?: number
}

export type AddressUtxoResponse = {
  txid: string
  vout: number
  value: number
  status: UtxoStatus
}

export type BroadcastTxResponse = string

export interface paths {
  "/address/{address}": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": AddressInfoResponse
          }
        }
      }
    }
  }
  "/address/{address}/utxo": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": AddressUtxoResponse[]
          }
        }
      }
    }
  }
  "/tx": {
    post: {
      requestBody: {
        content: {
          "text/plain": string
        }
      }
      responses: {
        200: {
          content: {
            "text/plain": BroadcastTxResponse
          }
        }
      }
    }
  }
}
