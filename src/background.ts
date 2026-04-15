type RuntimeApi = {
  openOptionsPage?: () => void
}

type ActionApi = {
  onClicked?: {
    addListener: (callback: () => void) => void
  }
}

const scope = globalThis as typeof globalThis & {
  browser?: { runtime?: RuntimeApi; action?: ActionApi }
  chrome?: { runtime?: RuntimeApi; action?: ActionApi }
}

const runtime = scope.browser?.runtime ?? scope.chrome?.runtime
const action = scope.browser?.action ?? scope.chrome?.action

action?.onClicked?.addListener(() => {
  runtime?.openOptionsPage?.()
})
