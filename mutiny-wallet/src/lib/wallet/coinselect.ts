import { coinselect, dustThreshold } from "@bitcoinerlab/coinselect"
import { Output, networks } from "@bitcoinerlab/descriptors"

import { assertValidTestnetAddress } from "@/lib/wallet/address"
import {
  DustOutputError,
  InsufficientFundsError,
} from "@/lib/wallet/errors"
import type { WalletUtxo } from "@/lib/wallet/types"

export type TransactionOutput = {
  address: string
  valueSats: bigint
}

export type CoinSelection = {
  inputs: WalletUtxo[]
  outputs: TransactionOutput[]
  feeSats: bigint
  vsize: number
}

function outputForAddress(address: string): InstanceType<typeof Output> {
  return new Output({
    descriptor: `addr(${address})`,
    network: networks.testnet,
  })
}

export function dustThresholdForAddress(address: string): bigint {
  assertValidTestnetAddress(address)
  return dustThreshold(outputForAddress(address))
}

export function selectCoins(params: {
  utxos: WalletUtxo[]
  to: string
  amountSats: bigint
  feeRate: number
  changeAddress: string
}): CoinSelection {
  const { utxos, to, amountSats, feeRate, changeAddress } = params
  assertValidTestnetAddress(to)
  assertValidTestnetAddress(changeAddress)

  const minOutputValue = dustThresholdForAddress(to)
  if (amountSats < minOutputValue) {
    throw new DustOutputError(amountSats, minOutputValue)
  }

  const outputToUtxo = new Map<InstanceType<typeof Output>, WalletUtxo>()
  const candidateUtxos = utxos.map((utxo) => ({
    output: (() => {
      const output = outputForAddress(changeAddress)
      outputToUtxo.set(output, utxo)
      return output
    })(),
    value: utxo.valueSats,
  }))

  const target = {
    output: outputForAddress(to),
    value: amountSats,
  }

  const result = coinselect({
    utxos: candidateUtxos,
    targets: [target],
    remainder: outputForAddress(changeAddress),
    feeRate,
  })

  if (!result) {
    throw new InsufficientFundsError()
  }

  const outputs = result.targets.map((selectedTarget, index) => ({
    address: index === 0 ? to : changeAddress,
    valueSats: selectedTarget.value,
  }))

  return {
    inputs: result.utxos.map((selected) => {
      const utxo = outputToUtxo.get(selected.output)
      if (!utxo) {
        throw new Error("Selected UTXO not found")
      }
      return utxo
    }),
    outputs,
    feeSats: result.fee,
    vsize: result.vsize,
  }
}
