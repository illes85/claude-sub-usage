export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
    'sub-usage': { limits: Limit[]; isHidden: boolean }
  }
}
