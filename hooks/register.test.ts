import { test, expect, mock } from 'claude-code/testing'

test('band shows rate-limit windows after a measurement', async ($, on) => {
  const statuses: (string | undefined)[] = []
  const toasts: string[] = []

  mock.clock(on)
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.status', (_$, e: any) => (statuses.push(e.text), { value: undefined }) as any)
  on('ui.toast', (_$, e: any) => (toasts.push(e.text), { value: undefined }) as any)

  await $.session.measure({
    context: {} as any,
    rateLimits: [
      { kind: 'five_hour', percentUsed: 42.5 },
      { kind: 'seven_day', percentUsed: 91 }
    ],
    changed: ['rateLimits']
  } as any)

  expect(toasts.some(t => /Weekly limit 91%/.test(t))).toBe(true)
  expect(toasts.some(t => /5h/.test(t))).toBe(false)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'sub-usage',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false }
    } as any)

    expect(await ui.find({ type: 'Text', text: /5h.*42.5%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Weekly.*91%/ })).toBeDefined()
    await ui.unmount()
  }
})
