import { extendUser, Activity } from 'koishi-core'

declare module 'koishi-core/dist/database' {
  interface UserData {
    interactiveness: Activity
  }
}

extendUser(() => ({ interactiveness: {} }))
