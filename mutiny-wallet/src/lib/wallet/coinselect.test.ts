import { describe, expect, it } from "vitest"

import { selectCoins } from "@/lib/wallet/coinselect"
import {
  DustOutputError,
  InsufficientFundsError,
} from "@/lib/wallet/errors"
import {
  FIXED_ADDRESS,
  RECIPIENT_ADDRESS,
  makeWalletUtxo,
} from "@/lib/wallet/test-helpers"

describe("coin selection", () => {
  it("selects the 50k utxo, creates change, and estimates the fee near 141 vB at 1 sat/vB", () => {
    const selection = selectCoins({
      utxos: [
        makeWalletUtxo(10_000n, "01".repeat(32), 0),
        makeWalletUtxo(20_000n, "02".repeat(32), 1),
        makeWalletUtxo(50_000n, "03".repeat(32), 2),
      ],
      to: RECIPIENT_ADDRESS,
      amountSats: 25_000n,
      feeRate: 1,
      changeAddress: FIXED_ADDRESS,
    })

    expect(selection.inputs.map((utxo) => utxo.valueSats)).toEqual([50_000n])
    expect(selection.outputs).toEqual([
      { address: RECIPIENT_ADDRESS, valueSats: 25_000n },
      { address: FIXED_ADDRESS, valueSats: 24_859n },
    ])
    expect(selection.feeSats).toBe(141n)
    expect(selection.vsize).toBe(141)
  })

  it("spends without change when the target matches available funds minus fee", () => {
    const selection = selectCoins({
      utxos: [makeWalletUtxo(50_000n, "04".repeat(32), 0)],
      to: RECIPIENT_ADDRESS,
      amountSats: 49_890n,
      feeRate: 1,
      changeAddress: FIXED_ADDRESS,
    })

    expect(selection.outputs).toEqual([
      { address: RECIPIENT_ADDRESS, valueSats: 49_890n },
    ])
    expect(selection.feeSats).toBe(110n)
    expect(selection.vsize).toBe(110)
  })

  it("throws a typed error when funds are insufficient", () => {
    expect(() =>
      selectCoins({
        utxos: [makeWalletUtxo(10_000n, "05".repeat(32), 0)],
        to: RECIPIENT_ADDRESS,
        amountSats: 25_000n,
        feeRate: 1,
        changeAddress: FIXED_ADDRESS,
      })
    ).toThrow(InsufficientFundsError)
  })

  it("rejects sub-dust outputs", () => {
    expect(() =>
      selectCoins({
        utxos: [makeWalletUtxo(10_000n, "06".repeat(32), 0)],
        to: RECIPIENT_ADDRESS,
        amountSats: 293n,
        feeRate: 1,
        changeAddress: FIXED_ADDRESS,
      })
    ).toThrow(DustOutputError)
  })
})
