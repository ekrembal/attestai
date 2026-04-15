type RuntimeApi = {
  lastError?: { message?: string }
  openOptionsPage?: () => void
}

type ActionApi = {
  onClicked?: {
    addListener: (callback: () => void) => void
  }
}

type CommandsApi = {
  onCommand?: {
    addListener: (callback: (command: string) => void) => void
  }
}

type TabsApi = {
  query: (queryInfo: {
    active: boolean
    currentWindow: boolean
  }) => Promise<Array<{ id?: number }>>
  sendMessage: (tabId: number, message: unknown) => Promise<unknown>
}

type ChromeTabsApi = {
  query: (
    queryInfo: { active: boolean; currentWindow: boolean },
    callback: (tabs: Array<{ id?: number }>) => void
  ) => Promise<Array<{ id?: number }>> | void
  sendMessage: (
    tabId: number,
    message: unknown,
    callback?: (response: unknown) => void
  ) => Promise<unknown> | void
}

const scope = globalThis as typeof globalThis & {
  browser?: {
    runtime?: RuntimeApi
    action?: ActionApi
    commands?: CommandsApi
    tabs?: TabsApi
  }
  chrome?: {
    runtime?: RuntimeApi
    action?: ActionApi
    commands?: CommandsApi
    tabs?: ChromeTabsApi
  }
}

const runtime = scope.browser?.runtime ?? scope.chrome?.runtime
const action = scope.browser?.action ?? scope.chrome?.action
const commands = scope.browser?.commands ?? scope.chrome?.commands
const browserTabs = scope.browser?.tabs
const chromeTabs = scope.chrome?.tabs

const RUN_PROMPT_FLOW_COMMAND = "run-prompt-flow"
const RUN_PROMPT_FLOW_MESSAGE = "attestai.runPromptFlow"

async function getActiveTabId(): Promise<number | null> {
  if (browserTabs) {
    const activeTabs = await browserTabs.query({
      active: true,
      currentWindow: true,
    })

    return activeTabs[0]?.id ?? null
  }

  if (!chromeTabs) {
    return null
  }

  return new Promise<number | null>((resolve) => {
    const maybePromise = chromeTabs.query(
      { active: true, currentWindow: true },
      (activeTabs) => {
        resolve(activeTabs[0]?.id ?? null)
      }
    )

    if (maybePromise && "then" in maybePromise) {
      maybePromise.then((activeTabs) => {
        resolve(activeTabs[0]?.id ?? null)
      })
    }
  })
}

async function forwardPromptFlowCommand() {
  const tabId = await getActiveTabId()

  if (tabId === null) {
    return
  }

  if (browserTabs) {
    await browserTabs
      .sendMessage(tabId, { type: RUN_PROMPT_FLOW_MESSAGE })
      .catch(() => undefined)
    return
  }

  const maybePromise = chromeTabs?.sendMessage(
    tabId,
    { type: RUN_PROMPT_FLOW_MESSAGE },
    () => {
      void runtime?.lastError
    }
  )

  if (maybePromise && "then" in maybePromise) {
    maybePromise.catch(() => undefined)
  }
}

action?.onClicked?.addListener(() => {
  runtime?.openOptionsPage?.()
})

commands?.onCommand?.addListener((command) => {
  if (command === RUN_PROMPT_FLOW_COMMAND) {
    void forwardPromptFlowCommand()
  }
})
