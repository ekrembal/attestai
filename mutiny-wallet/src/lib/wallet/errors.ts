export class InvalidAddressError extends Error {
  constructor(address: string) {
    super(`Invalid Mutinynet address: ${address}`)
    this.name = "InvalidAddressError"
  }
}

export class DustOutputError extends Error {
  constructor(amountSats: bigint, dustThresholdSats: bigint) {
    super(
      `Output amount ${amountSats} sats is below the dust threshold of ${dustThresholdSats} sats`
    )
    this.name = "DustOutputError"
  }
}

export class InsufficientFundsError extends Error {
  constructor() {
    super("Insufficient funds")
    this.name = "InsufficientFundsError"
  }
}
