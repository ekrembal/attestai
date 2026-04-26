import type { EsploraClient } from "@/lib/api/esplora"
import { assertValidTestnetAddress, scriptPubKeyFor } from "@/lib/wallet/address"
import { selectCoins } from "@/lib/wallet/coinselect"
import {
  buildPsbt,
  extractSignedTransaction,
  finalizePsbt,
  signPsbt,
} from "@/lib/wallet/psbt"
import { toWalletUtxo } from "@/lib/wallet/types"

export async function sendTransaction(params: {
  client: EsploraClient
  keyHex: string
  fromAddress: string
  to: string
  amountSats: bigint
  feeRate: number
}): Promise<string> {
  const { client, keyHex, fromAddress, to, amountSats, feeRate } = params
  assertValidTestnetAddress(to)

  const scriptPubKey = scriptPubKeyFor(fromAddress)
  const utxos = (await client.getAddressUtxos(fromAddress)).map((utxo) =>
    toWalletUtxo(utxo, scriptPubKey)
  )

  const selection = selectCoins({
    utxos,
    to,
    amountSats,
    feeRate,
    changeAddress: fromAddress,
  })

  const psbt = buildPsbt({
    utxos: selection.inputs,
    outputs: selection.outputs,
  })
  const signed = signPsbt(psbt, keyHex)
  const finalized = finalizePsbt(signed)
  const { txHex, txid } = extractSignedTransaction(finalized)

  await client.broadcastTx(txHex)
  return txid
}
