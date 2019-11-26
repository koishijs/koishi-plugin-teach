import { Database } from 'koishi-core'
import { escape } from 'mysql'

declare module 'koishi-core/dist/database/database' {
  interface Database {
    createDialogue (options: DialogueOptions): Promise<Dialogue>
    getDialogueTest (test: DialogueTest): string
    getDialogues (test: number[] | DialogueTest): Promise<Dialogue[]>
    setDialogue (id: number, data: Partial<Dialogue>): Promise<any>
    removeDialogues (ids: number[]): Promise<any>
  }
}

interface DialogueOptions {
  question: string
  answer: string
  writer: number
  groups: string
  successors: string
  flag: number
  probability: number
}

export interface Dialogue extends DialogueOptions {
  id: number
}

export enum DialogueFlag {
  frozen = 1,
  regexp = 2,
  appellation = 4,
}

interface DialogueTest {
  envMode?: -2 | -1 | 0 | 1 | 2
  groups?: number[]
  extraIds?: string[]
  question?: string
  answer?: string
  writer?: number
  keyword?: boolean
  strict?: boolean
  frozen?: boolean
}

Database.prototype.createDialogue = async function ({ question, answer, writer, groups, successors, flag, probability = 1 }) {
  return this.create('dialogues', {
    question,
    answer,
    groups,
    writer,
    successors,
    flag,
    probability,
  })
}

Database.prototype.getDialogueTest = function (this: Database, test: DialogueTest) {
  const conditionals: string[] = []
  if (test.keyword) {
    if (test.question) conditionals.push('`question` LIKE ' + escape(`%${test.question}%`))
    if (test.answer) conditionals.push('`answer` LIKE ' + escape(`%${test.answer}%`))
  } else {
    if (test.question) conditionals.push('`question` = ' + escape(test.question))
    if (test.answer) conditionals.push('`answer` = ' + escape(test.answer))
  }
  let envConditional = ''
  if (test.envMode === 2) {
    envConditional = `\`groups\` = "${test.groups.join(',')}"`
  } else if (test.envMode === -2) {
    envConditional = `\`groups\` = "*${test.groups.join(',')}"`
  } else if (test.envMode === 1) {
    envConditional = `\`groups\` NOT LIKE "*%" AND \`groups\` LIKE "%${test.groups.join(',%')}%" OR \`groups\` LIKE "*%" AND ${test.groups.map(id => `\`groups\` NOT LIKE "%${id}%"`).join(' AND ')}`
  } else if (test.envMode === -1) {
    envConditional = `\`groups\` LIKE "*%${test.groups.join(',%')}%" OR \`groups\` NOT LIKE "*%" AND ${test.groups.map(id => `\`groups\` NOT LIKE "%${id}%"`).join(' AND ')}`
  }
  if (envConditional) {
    if ((test.extraIds || []).length) {
      envConditional += ` OR \`id\` IN (${test.extraIds.join(',')})`
    }
    conditionals.push(`(${envConditional})`)
  }
  if (test.frozen === true) {
    conditionals.push('(`flag` & 1)')
  } else if (test.frozen === false) {
    conditionals.push('!(`flag` & 1)')
  }
  if (test.writer) conditionals.push('`writer` = ' + test.writer)
  if (!conditionals.length) return ''
  return ' WHERE ' + conditionals.join(' AND ')
}

Database.prototype.getDialogues = async function (this: Database, test: DialogueTest | number[] = {}) {
  if (Array.isArray(test)) {
    if (!test.length) return []
    return await this.query(`SELECT * FROM \`dialogues\` WHERE \`id\` IN (${test.join(',')})`)
  }
  return await this.query('SELECT * FROM `dialogues`' + this.getDialogueTest(test))
}

Database.prototype.setDialogue = async function (this: Database, id, data) {
  return this.update('dialogues', id, data)
}

Database.prototype.removeDialogues = async function (this: Database, ids) {
  return this.query(`DELETE FROM \`dialogues\` WHERE \`id\` IN (${ids.join(',')})`)
}
