import { GroupContext, updateActivity } from 'koishi-core'
import { randomPick, CQCode, sleep } from 'koishi-utils'
import { simplifyQuestion, splitIds } from './utils'

interface State {
  currentUser: number
  currentCount: number
  predecessors: Record<number, number>
}

const states: Record<number, State> = {}
const MAX_CONSECUTIVE = 5

function escapeAnswer (message: string) {
  return message.replace(/\$/g, '@@__DOLLARS_PLACEHOLDER__@@')
}

export default function (ctx: GroupContext) {
  ctx.middleware(async (meta, next) => {
    const { groupId } = meta
    if (!states[groupId]) states[groupId] = { currentUser: 0, currentCount: 0, predecessors: {} }
    const state = states[groupId]
    const question = simplifyQuestion(meta.message)
    if (!question) return next()

    if (state.currentUser !== meta.userId) {
      state.currentUser = meta.userId
      state.currentCount = 0
    } else if (state.currentCount >= MAX_CONSECUTIVE) {
      return next()
    }

    const items = await ctx.database.getDialogues({
      question,
      envMode: 1,
      groups: [groupId],
      extraIds: Object.keys(state.predecessors),
    })
    if (!items.length) return next()

    const dialogue = randomPick(items)
    if (!dialogue || dialogue.probability < 1 && dialogue.probability <= Math.random()) return next()

    state.currentCount += 1
    const { interactiveness, name } = meta.$user
    updateActivity(interactiveness, groupId)
    await meta.$user._update()

    const answers = dialogue.answer
      .replace(/\$\$/g, '@@__DOLLARS_PLACEHOLDER__@@')
      .replace(/\$a/g, `[CQ:at,qq=${meta.userId}]`)
      .replace(/\$A/g, '[CQ:at,qq=all]')
      .replace(/\$m/g, CQCode.stringify('at', { qq: meta.selfId }))
      .replace(/\$s/g, escapeAnswer(name === String(meta.userId) ? meta.sender.card || meta.sender.nickname : name))
      .replace(/\$0/g, escapeAnswer(meta.message))
      .split('$n')
      .map(str => str.trim().replace(/@@__DOLLARS_PLACEHOLDER__@@/g, '$'))

    for (const answer of answers) {
      await sleep(answer.length * 50)
      await meta.$send(answer)
    }
    const successors = await ctx.database.getDialogues(splitIds(dialogue.successors))
    if (!successors.length) return
    const time = Date.now()
    for (const successor of successors) {
      state.predecessors[successor.id] = time
    }
    setTimeout(() => {
      const { predecessors } = states[meta.groupId]
      for (const successor of successors) {
        if (predecessors[successor.id] === time) {
          delete predecessors[successor.id]
        }
      }
    }, 20000)
  })
}
