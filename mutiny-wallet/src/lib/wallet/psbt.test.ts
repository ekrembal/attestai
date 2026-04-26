import * as bitcoin from "bitcoinjs-lib"
import ecc from "@bitcoinerlab/secp256k1"
import { describe, expect, it } from "vitest"

import { publicKeyFromPrivateKeyHex } from "@/lib/wallet/address"
import { hexToBytes } from "@/lib/wallet/hex"
import {
  buildPsbt,
  extractSignedTransaction,
  finalizePsbt,
  signPsbt,
} from "@/lib/wallet/psbt"
import {
  FIXED_ADDRESS,
  FIXED_PRIVATE_KEY_HEX,
  RECIPIENT_ADDRESS,
  WRONG_PRIVATE_KEY_HEX,
  makeWalletUtxo,
} from "@/lib/wallet/test-helpers"

describe("psbt", () => {
  it("builds, signs, finalizes, and extracts a deterministic transaction", () => {
    const psbt = buildPsbt({
      utxos: [makeWalletUtxo(100_000n, "11".repeat(32), 0, FIXED_ADDRESS)],
      outputs: [
        { address: RECIPIENT_ADDRESS, valueSats: 30_000n },
        { address: FIXED_ADDRESS, valueSats: 69_859n },
      ],
    })

    const signed = signPsbt(psbt, FIXED_PRIVATE_KEY_HEX)
    const finalized = finalizePsbt(signed)
    const { txHex, txid } = extractSignedTransaction(finalized)
    const tx = bitcoin.Transaction.fromHex(txHex)

    expect(tx.ins).toHaveLength(1)
    expect(tx.outs).toHaveLength(2)
    expect(txid).toBe(
      "863acf70e99c259ce23a88a9053a0f3959efacb994ca02eefa2d5ee8bfdab9cd"
    )
    expect(tx.ins[0]?.witness).toHaveLength(2)

    const roundTrip = bitcoin.Psbt.fromBase64(finalized.toBase64(), {
      network: bitcoin.networks.testnet,
    })
    expect(roundTrip.toBase64()).toBe(finalized.toBase64())
  })

  it("fails to finalize when signed with the wrong key", () => {
    const psbt = buildPsbt({
      utxos: [makeWalletUtxo(100_000n, "12".repeat(32), 0, FIXED_ADDRESS)],
      outputs: [{ address: RECIPIENT_ADDRESS, valueSats: 99_000n }],
    })

    const wrongPrivateKey = hexToBytes(WRONG_PRIVATE_KEY_HEX)
    const fakeSigner = {
      publicKey: publicKeyFromPrivateKeyHex(FIXED_PRIVATE_KEY_HEX),
      sign(hash: Uint8Array) {
        return ecc.sign(hash, wrongPrivateKey)
      },
    }

    psbt.signInput(0, fakeSigner)

    expect(() => finalizePsbt(psbt)).toThrow("Invalid signature detected")
  })
})
