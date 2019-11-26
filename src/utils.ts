import { Context, ParsedArgv, Meta } from 'koishi-core'
import { simplify, isInteger, randomId } from 'koishi-utils'
import { createHash } from 'crypto'
import axios from 'axios'

const imageRE = /\[CQ:image,file=([^,]+),url=([^\]]+)\]/
export const IMAGE_SERVER = 'https://shiki.shigma.xyz/img'
export const UPLOAD_SERVER = 'https://shiki.shigma.xyz/upload'

export async function processAnswer (source: string, key: string) {
  let temp = ''
	let capture = source.match(imageRE)
	while (capture) {
    const [text, file, url] = capture
    temp += source.slice(0, capture.index)
    source = source.slice(capture.index + text.length)
    const salt = randomId()
    const sign = createHash('md5').update(file + salt + key).digest('hex')
    await axios.get(UPLOAD_SERVER, {
      params: { salt, sign, url, file },
    })
    temp += `[CQ:image,file=${IMAGE_SERVER}/${file}]`
		capture = source.match(imageRE)
  }
  return temp + source
}

const prefixPunctuation = /^([()\]]|\[(?!cq:))*/
const suffixPunctuation = /([\.,?!()\[~]|(?<!\[cq:[^\]]+)\])*$/

export function stripPunctuation (source: string) {
  source = source.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/，/g, ',')
    .replace(/、/g, ',')
    .replace(/。/g, '.')
    .replace(/？/g, '?')
    .replace(/！/g, '!')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/【/g, '[')
    .replace(/】/g, ']')
    .replace(/～/g, '~')
  return source
    .replace(prefixPunctuation, '')
    .replace(suffixPunctuation, '') || source
}

export function simplifyQuestion (source: string) {
  return simplify(stripPunctuation(String(source || '')))
}

export function simplifyAnswer (source: string) {
  return (String(source || '')).trim()
}

export function splitIds (source: string) {
  return source ? source.split(',').map(i => parseInt(i)) : []
}

export interface TeachOptions {
  ctx: Context
  meta: Meta
  args: string[]
  argc: number
  options: Record<string, any>
  writer?: number
  groups?: number[]
  envMode?: -2 | -1 | 0 | 1 | 2
  addSuccessor?: number[]
  addPredecessor?: number[]
  removeSuccessor?: number[]
  removePredecessor?: number[]
}

export default function parseOptions (ctx: Context, parsedArgv: ParsedArgv) {
  const { options, meta, args } = parsedArgv
  let argc = args.length

  if (options.addPredecessor || options.removePredecessor || options.regexp) {
    return meta.$send('本功能目前处于维护中，暂时停止访问。')
  }

  if (typeof options.chance === 'number' && (options.chance <= 0 || options.chance > 1)) {
    return meta.$send('参数 -c, --chance 应为不超过 1 的正数。')
  }

  const parsedOptions: TeachOptions = { ctx, meta, argc, args, options }

  if (options.noWriter) {
    parsedOptions.writer = 0
  } else if (options.writer) {
    if (isInteger(options.writer) && options.writer > 0) {
      parsedOptions.writer = options.writer
    } else {
      return meta.$send(`参数 -w, --writer 错误，请检查指令语法。`)
    }
  }

  if (options.minAffinity !== undefined) {
    if (!isInteger(options.minAffinity) || options.minAffinity < 0 || options.minAffinity >= 32768) {
      return meta.$send(`参数 -m, --min-affinity 错误，请检查指令语法。`)
    }
  }

  if (options.maxAffinity !== undefined) {
    if (!isInteger(options.maxAffinity) || options.maxAffinity <= 0 || options.maxAffinity > 32768) {
      return meta.$send(`参数 -m, --max-affinity 错误，请检查指令语法。`)
    }
  }

  if (options.globalEnv) {
    parsedOptions.envMode = -2
    parsedOptions.groups = []
  } else if (options.noEnv) {
    parsedOptions.envMode = 2
    parsedOptions.groups = []
  } else if (typeof options.env === 'string') {
    if (options.env.match(/^(\*?(\d{9}(,\d{9})*)?|[#~]\d{9}(,\d{9})*)$/)) {
      parsedOptions.groups = splitIds(options.env.replace(/^[#~*]/, '')).sort()
      parsedOptions.envMode = options.env.startsWith('*') ? -2
        : options.env.startsWith('#') ? 1
        : options.env.startsWith('~') ? -1
        : 2
    } else {
      return meta.$send(`参数 -e, --env 错误，请检查指令语法。`)
    }
  }

  if (options.addSuccessor) {
    if (options.addSuccessor.match(/^\d+(,\d+)*$/)) {
      parsedOptions.addSuccessor = splitIds(options.addSuccessor)
    } else {
      return meta.$send(`参数 -s, --add-successor 错误，请检查指令语法。`)
    }
  }

  if (options.removeSuccessor) {
    if (options.removeSuccessor.match(/^\d+(,\d+)*$/)) {
      parsedOptions.removeSuccessor = splitIds(options.removeSuccessor)
    } else {
      return meta.$send(`参数 -S, --remove-successor 错误，请检查指令语法。`)
    }
  }

  if (options.addPredecessor) {
    if (options.addPredecessor.match(/^\d+(,\d+)*$/)) {
      parsedOptions.addPredecessor = splitIds(options.addPredecessor)
    } else {
      return meta.$send(`参数 -p, --add-predecessor 错误，请检查指令语法。`)
    }
  }

  if (options.removePredecessor) {
    if (options.removePredecessor.match(/^\d+(,\d+)*$/)) {
      parsedOptions.removePredecessor = splitIds(options.removePredecessor)
    } else {
      return meta.$send(`参数 -P, --remove-predecessor 错误，请检查指令语法。`)
    }
  }

  if (String(options.question).includes('[CQ:image,')) return meta.$send('问题不能包含图片。')
  options.question = simplifyQuestion(options.question)
  if (!options.question) delete options.question
  options.answer = simplifyAnswer(options.answer)
  if (!options.answer) delete options.answer

  return parsedOptions
}
