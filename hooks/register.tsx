import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const limits = atom({ plugin: 'sub-usage', key: 'limits' } as const, [])
const isHidden = atom({ plugin: 'sub-usage', key: 'isHidden' } as const, false)

const LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: 'Weekly',
  spend_limit: 'Spend'
}
const WARN_AT = [80, 90, 100]

const label = (kind: string) => LABELS[kind] ?? kind

const bar = (pct: number) => {
  const filled = Math.max(0, Math.min(10, Math.round(pct / 10)))

  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

const until = (iso: string | undefined, now: number) => {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.parse(iso) - now) / 60000))
  const text = mins >= 1440 ? `${Math.floor(mins / 1440)}d` : mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60}m` : `${mins}m`

  return ` ↻${text}`
}

// highest threshold already warned about, per window and reset time
const warned = new Map<string, number>()

async function apply($: any, next: Limit[]) {
  await update($, limits, () => next)
  $.ui.status(next.length ? next.map(l => `${label(l.kind)} ${l.percentUsed}%`).join(' · ') : undefined)

  for (const l of next) {
    const key = `${l.kind}@${l.resetsAt ?? ''}`
    const hit = WARN_AT.filter(t => l.percentUsed >= t).pop() ?? 0

    if (hit > (warned.get(key) ?? 0)) {
      warned.set(key, hit)
      $.ui.toast(`${label(l.kind)} limit ${l.percentUsed}% used`)
    }
  }
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    const u = await $.session.usage()
    await apply($, u.rateLimits)

    $.command.register({ name: 'usage-bar', description: 'Show or hide the subscription usage band' })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await apply($, e.rateLimits)
    }

    return next(e)
  })

  on('command.run', { name: 'usage-bar' }, async ($, e, next) => {
    const hidden = await read($, isHidden)
    await update($, isHidden, () => !hidden)

    return { text: hidden ? 'Usage band shown' : 'Usage band hidden' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const ls = await read($, limits)

    if (e.props.hasSurvey || ls.length === 0 || (await read($, isHidden))) {
      return next(e)
    }

    const now = await $.clock.now()
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        {ls.map(l => (
          <Text key={l.kind} color={l.percentUsed >= 90 ? 'red' : l.percentUsed >= 70 ? 'yellow' : undefined}>
            {label(l.kind)} {bar(l.percentUsed)} {l.percentUsed}%{until(l.resetsAt, now)}
            {'   '}
          </Text>
        ))}
      </Box>
    )
  })
}
