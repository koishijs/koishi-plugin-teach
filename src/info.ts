import { TeachOptions } from './utils'

export default async function apply (config: TeachOptions) {
  if (config.options.info) {
    let { envMode, groups, ctx, meta, options } = config
    if (!envMode && !options.allEnv) {
      envMode = 1
      groups = [meta.groupId]
    }
    const test = ctx.database.getDialogueTest({ envMode, groups })
    const {
      'COUNT(DISTINCT `question`)': questions,
      'COUNT(*)': answers
    } = await ctx.database.query('SELECT COUNT(DISTINCT `question`), COUNT(*) FROM `dialogues`' + test)
    return meta.$send(`共收录了 ${questions} 个问题和 ${answers} 个回答。`)
  }
}
