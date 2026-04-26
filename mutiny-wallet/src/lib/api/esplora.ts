import type {
  AddressInfoResponse,
  AddressUtxoResponse,
  BroadcastTxResponse,
} from "@/lib/api/schema"

export type EsploraUtxo = AddressUtxoResponse
export type EsploraAddressInfo = AddressInfoResponse

export interface EsploraClient {
  getAddressInfo(address: string): Promise<EsploraAddressInfo>
  getAddressUtxos(address: string): Promise<EsploraUtxo[]>
  broadcastTx(txHex: string): Promise<string>
}

type FetchLike = typeof fetch

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return (await response.json()) as T
}

async function readText(response: Response): Promise<string> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.text()
}

export function createEsploraClient(
  baseUrl: string,
  fetchFn: FetchLike = fetch
): EsploraClient {
  const origin = baseUrl.replace(/\/+$/, "")

  return {
    async getAddressInfo(address) {
      const response = await fetchFn(
        `${origin}/address/${encodeURIComponent(address)}`
      )
      return readJson<AddressInfoResponse>(response)
    },
    async getAddressUtxos(address) {
      const response = await fetchFn(
        `${origin}/address/${encodeURIComponent(address)}/utxo`
      )
      return readJson<AddressUtxoResponse[]>(response)
    },
    async broadcastTx(txHex) {
      const response = await fetchFn(`${origin}/tx`, {
        method: "POST",
        headers: {
          "content-type": "text/plain",
        },
        body: txHex,
      })
      return readText(response) as Promise<BroadcastTxResponse>
    },
  }
}
