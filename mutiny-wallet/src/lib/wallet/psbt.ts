import * as bitcoin from "bitcoinjs-lib"
import ecc from "@bitcoinerlab/secp256k1"

import {
  MUTINY_NETWORK,
  assertValidPrivateKeyHex,
  publicKeyFromPrivateKeyHex,
} from "@/lib/wallet/address"
import type { TransactionOutput } from "@/lib/wallet/coinselect"
import { hexToBytes } from "@/lib/wallet/hex"
import type { WalletUtxo } from "@/lib/wallet/types"

bitcoin.initEccLib(ecc)

export type SignedTransaction = {
  txHex: string
  txid: string
}

type Signer = {
  publicKey: Uint8Array
  sign(hash: Uint8Array): Uint8Array
}

function createSigner(keyHex: string): Signer {
  assertValidPrivateKeyHex(keyHex)
  const privateKey = hexToBytes(keyHex)

  return {
    publicKey: publicKeyFromPrivateKeyHex(keyHex),
    sign(hash) {
      return ecc.sign(hash, privateKey)
    },
  }
}

export function buildPsbt(params: {
  utxos: WalletUtxo[]
  outputs: TransactionOutput[]
}): bitcoin.Psbt {
  const psbt = new bitcoin.Psbt({ network: MUTINY_NETWORK })

  for (const utxo of params.utxos) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: hexToBytes(utxo.scriptPubKey),
        value: utxo.valueSats,
      },
    })
  }

  for (const output of params.outputs) {
    psbt.addOutput({
      address: output.address,
      value: output.valueSats,
    })
  }

  return psbt
}

export function signPsbt(psbt: bitcoin.Psbt, keyHex: string): bitcoin.Psbt {
  const signer = createSigner(keyHex)
  const next = psbt.clone()

  for (let index = 0; index < next.inputCount; index += 1) {
    next.signInput(index, signer)
  }

  return next
}

export function finalizePsbt(psbt: bitcoin.Psbt): bitcoin.Psbt {
  const next = psbt.clone()
  const signaturesValid = next.validateSignaturesOfAllInputs(
    (pubkey, hash, signature) => ecc.verify(hash, pubkey, signature)
  )

  if (!signaturesValid) {
    throw new Error("Invalid signature detected")
  }

  next.finalizeAllInputs()
  return next
}

export function extractSignedTransaction(psbt: bitcoin.Psbt): SignedTransaction {
  const transaction = psbt.extractTransaction(true)

  return {
    txHex: transaction.toHex(),
    txid: transaction.getId(),
  }
}
