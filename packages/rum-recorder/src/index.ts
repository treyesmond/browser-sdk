// Keep the following in sync with packages/rum/src/index.ts
export { datadogRum } from './boot/recorder.entry'
export {
  CommonProperties,
  ProvidedSource,
  RumUserConfiguration,
  // Events
  RumEvent,
  RumActionEvent,
  RumErrorEvent,
  RumLongTaskEvent,
  RumResourceEvent,
  RumViewEvent,
} from '@datadog/browser-rum-core'

export { RumRecorderPublicApi as RumGlobal, RumRecorderUserConfiguration } from './boot/rumRecorderPublicApi'
