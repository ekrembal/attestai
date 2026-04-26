import { describe, expect, it } from "vitest"

import {
  deriveP2wpkhAddress,
  isValidTestnetAddress,
  scriptPubKeyFor,
} from "@/lib/wallet/address"
import {
  FIXED_ADDRESS,
  FIXED_PRIVATE_KEY_HEX,
} from "@/lib/wallet/test-helpers"

describe("address", () => {
  it("derives the expected fixed testnet address", () => {
    expect(deriveP2wpkhAddress(FIXED_PRIVATE_KEY_HEX)).toBe(FIXED_ADDRESS)
    expect(FIXED_ADDRESS).toBe("tb1q85p2ew8xztcuyame8g3j7g9kj058wq8r0r6eu4")
  })

  it("validates mutinynet addresses and rejects mainnet or malformed ones", () => {
    expect(isValidTestnetAddress(FIXED_ADDRESS)).toBe(true)
    expect(
      isValidTestnetAddress("bc1q85p2ew8xztcuyame8g3j7g9kj058wq8rr7s2x5")
    ).toBe(false)
    expect(isValidTestnetAddress("not-an-address")).toBe(false)
    expect(
      isValidTestnetAddress("tb1q85p2ew8xztcuyame8g3j7g9kj058wq8r0r6eu5")
    ).toBe(false)
  })

  it("returns the expected p2wpkh scriptPubKey", () => {
    const scriptPubKey = scriptPubKeyFor(FIXED_ADDRESS)

    expect(scriptPubKey).toBe("00143d02acb8e612f1c277793a232f20b693e87700e3")
    expect(scriptPubKey).toHaveLength(44)
    expect(scriptPubKey.startsWith("0014")).toBe(true)
  })
})
