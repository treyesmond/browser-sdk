import {
  addEventListener,
  Context,
  DOM_EVENT,
  Duration,
  elapsed,
  generateUUID,
  ClocksState,
  clocksNow,
  TimeStamp,
} from '@datadog/browser-core'
import { ActionType } from '../../../rawRumEvent.types'
import { LifeCycle, LifeCycleEventType } from '../../lifeCycle'
import { EventCounts, trackEventCounts } from '../../trackEventCounts'
import { waitIdlePageActivity } from '../../trackPageActivities'
import { getActionNameFromElement } from './getActionNameFromElement'

type AutoActionType = ActionType.CLICK

export interface ActionCounts {
  errorCount: number
  longTaskCount: number
  resourceCount: number
}

export interface CustomAction {
  type: ActionType.CUSTOM
  name: string
  startClocks: ClocksState
  context?: Context
}

export interface AutoAction {
  type: AutoActionType
  id: string
  name: string
  startClocks: ClocksState
  duration: Duration
  counts: ActionCounts
}

export interface AutoActionCreatedEvent {
  id: string
  startClocks: ClocksState
}

export function trackActions(lifeCycle: LifeCycle) {
  const action = startActionManagement(lifeCycle)

  // New views trigger the discard of the current pending Action
  lifeCycle.subscribe(LifeCycleEventType.VIEW_CREATED, () => {
    action.discardCurrent()
  })

  const { stop: stopListener } = addEventListener(
    window,
    DOM_EVENT.CLICK,
    (event) => {
      if (!(event.target instanceof Element)) {
        return
      }
      const name = getActionNameFromElement(event.target)
      if (!name) {
        return
      }

      action.create(ActionType.CLICK, name)
    },
    { capture: true }
  )

  return {
    stop() {
      action.discardCurrent()
      stopListener()
    },
  }
}

function startActionManagement(lifeCycle: LifeCycle) {
  let currentAction: PendingAutoAction | undefined
  let currentIdlePageActivitySubscription: { stop: () => void }

  return {
    create: (type: AutoActionType, name: string) => {
      if (currentAction) {
        // Ignore any new action if another one is already occurring.
        return
      }
      const pendingAutoAction = new PendingAutoAction(lifeCycle, type, name)

      currentAction = pendingAutoAction
      currentIdlePageActivitySubscription = waitIdlePageActivity(lifeCycle, (params) => {
        if (params.hadActivity) {
          pendingAutoAction.complete(params.endTime)
        } else {
          pendingAutoAction.discard()
        }
        currentAction = undefined
      })
    },
    discardCurrent: () => {
      if (currentAction) {
        currentIdlePageActivitySubscription.stop()
        currentAction.discard()
        currentAction = undefined
      }
    },
  }
}

class PendingAutoAction {
  private id: string
  private startClocks: ClocksState
  private eventCountsSubscription: { eventCounts: EventCounts; stop(): void }

  constructor(private lifeCycle: LifeCycle, private type: AutoActionType, private name: string) {
    this.id = generateUUID()
    this.startClocks = clocksNow()
    this.eventCountsSubscription = trackEventCounts(lifeCycle)
    this.lifeCycle.notify(LifeCycleEventType.AUTO_ACTION_CREATED, { id: this.id, startClocks: this.startClocks })
  }

  complete(endTime: TimeStamp) {
    const eventCounts = this.eventCountsSubscription.eventCounts
    this.lifeCycle.notify(LifeCycleEventType.AUTO_ACTION_COMPLETED, {
      counts: {
        errorCount: eventCounts.errorCount,
        longTaskCount: eventCounts.longTaskCount,
        resourceCount: eventCounts.resourceCount,
      },
      duration: elapsed(this.startClocks.timeStamp, endTime),
      id: this.id,
      name: this.name,
      startClocks: this.startClocks,
      type: this.type,
    })
    this.eventCountsSubscription.stop()
  }

  discard() {
    this.lifeCycle.notify(LifeCycleEventType.AUTO_ACTION_DISCARDED)
    this.eventCountsSubscription.stop()
  }
}
