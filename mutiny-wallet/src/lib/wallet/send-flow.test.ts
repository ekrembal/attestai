import * as bitcoin from "bitcoinjs-lib"
import { describe, expect, it } from "vitest"

import { InsufficientFundsError, InvalidAddressError } from "@/lib/wallet/errors"
import { sendTransaction } from "@/lib/wallet/send"
import {
  FIXED_ADDRESS,
  FIXED_PRIVATE_KEY_HEX,
  RECIPIENT_ADDRESS,
  FakeEsploraClient,
} from "@/lib/wallet/test-helpers"

describe("send flow", () => {
  it("builds, signs, and broadcasts exactly once", async () => {
    const client = new FakeEsploraClient([
      {
        txid: "21".repeat(32),
        vout: 0,
        value: 60_000,
        status: { confirmed: true },
      },
      {
        txid: "22".repeat(32),
        vout: 1,
        value: 40_000,
        status: { confirmed: true },
      },
    ])

    const txid = await sendTransaction({
      client,
      keyHex: FIXED_PRIVATE_KEY_HEX,
      fromAddress: FIXED_ADDRESS,
      to: RECIPIENT_ADDRESS,
      amountSats: 30_000n,
      feeRate: 2,
    })

    expect(client.broadcastCalls).toBe(1)
    expect(client.lastBroadcastHex).not.toBeNull()
    expect(txid).toHaveLength(64)

    const parsed = bitcoin.Transaction.fromHex(client.lastBroadcastHex!)
    expect(parsed.getId()).toBe(txid)
  })

  it("throws a typed insufficient funds error without broadcasting", async () => {
    const client = new FakeEsploraClient([
      {
        txid: "23".repeat(32),
        vout: 0,
        value: 10_000,
        status: { confirmed: true },
      },
    ])

    await expect(
      sendTransaction({
        client,
        keyHex: FIXED_PRIVATE_KEY_HEX,
        fromAddress: FIXED_ADDRESS,
        to: RECIPIENT_ADDRESS,
        amountSats: 30_000n,
        feeRate: 2,
      })
    ).rejects.toThrow(InsufficientFundsError)

    expect(client.broadcastCalls).toBe(0)
  })

  it("rejects an invalid destination before fetching utxos", async () => {
    const client = new FakeEsploraClient([])

    await expect(
      sendTransaction({
        client,
        keyHex: FIXED_PRIVATE_KEY_HEX,
        fromAddress: FIXED_ADDRESS,
        to: "bc1qnotmutinynetaddress0000000000000000000000",
        amountSats: 30_000n,
        feeRate: 2,
      })
    ).rejects.toThrow(InvalidAddressError)

    expect(client.utxoFetches).toBe(0)
    expect(client.broadcastCalls).toBe(0)
  })
})
