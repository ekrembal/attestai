import * as bitcoin from "bitcoinjs-lib"
import ecc from "@bitcoinerlab/secp256k1"

import { bytesToHex, hexToBytes } from "@/lib/wallet/hex"
import { InvalidAddressError } from "@/lib/wallet/errors"

bitcoin.initEccLib(ecc)

export const MUTINY_NETWORK = bitcoin.networks.testnet
const PRIVATE_KEY_BYTES = 32

export function isValidPrivateKeyHex(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value) && ecc.isPrivate(hexToBytes(value))
}

export function assertValidPrivateKeyHex(value: string): void {
  if (!isValidPrivateKeyHex(value)) {
    throw new Error("Invalid private key hex")
  }
}

export function generatePrivateKeyHex(
  fillRandomBytes: (bytes: Uint8Array) => Uint8Array
): string {
  while (true) {
    const bytes = new Uint8Array(PRIVATE_KEY_BYTES)
    fillRandomBytes(bytes)
    const hex = bytesToHex(bytes)

    if (isValidPrivateKeyHex(hex)) {
      return hex
    }
  }
}

export function publicKeyFromPrivateKeyHex(keyHex: string): Uint8Array {
  assertValidPrivateKeyHex(keyHex)

  const publicKey = ecc.pointFromScalar(hexToBytes(keyHex), true)
  if (!publicKey) {
    throw new Error("Unable to derive public key")
  }

  return publicKey
}

export function deriveP2wpkhAddress(keyHex: string): string {
  const payment = bitcoin.payments.p2wpkh({
    pubkey: publicKeyFromPrivateKeyHex(keyHex),
    network: MUTINY_NETWORK,
  })

  if (!payment.address) {
    throw new Error("Unable to derive address")
  }

  return payment.address
}

export function isValidTestnetAddress(address: string): boolean {
  try {
    bitcoin.address.toOutputScript(address, MUTINY_NETWORK)
    return true
  } catch {
    return false
  }
}

export function assertValidTestnetAddress(address: string): void {
  if (!isValidTestnetAddress(address)) {
    throw new InvalidAddressError(address)
  }
}

export function scriptPubKeyFor(address: string): string {
  assertValidTestnetAddress(address)
  return bytesToHex(bitcoin.address.toOutputScript(address, MUTINY_NETWORK))
}
