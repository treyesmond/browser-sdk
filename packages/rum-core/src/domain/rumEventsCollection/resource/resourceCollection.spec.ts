import { Duration, RelativeTime, RequestType, ResourceType, ServerDuration, TimeStamp } from '@datadog/browser-core'
import { createResourceEntry } from '../../../../test/fixtures'
import { setup, TestSetupBuilder } from '../../../../test/specHelper'
import { RawRumResourceEvent, RumEventType } from '../../../rawRumEvent.types'
import { LifeCycleEventType } from '../../lifeCycle'
import { RequestCompleteEvent } from '../../requestCollection'
import { TraceIdentifier } from '../../tracing/tracer'
import { startResourceCollection } from './resourceCollection'

describe('resourceCollection', () => {
  let setupBuilder: TestSetupBuilder

  describe('when resource tracking is enabled', () => {
    beforeEach(() => {
      setupBuilder = setup()
        .withSession({
          getId: () => '1234',
          isTracked: () => true,
          isTrackedWithResource: () => true,
        })
        .withConfiguration({
          isEnabled: () => true,
        })
        .beforeBuild(({ lifeCycle, session }) => {
          startResourceCollection(lifeCycle, session)
        })
    })

    afterEach(() => {
      setupBuilder.cleanup()
    })

    it('should create resource from performance entry', () => {
      const { lifeCycle, rawRumEvents } = setupBuilder.build()
      lifeCycle.notify(
        LifeCycleEventType.PERFORMANCE_ENTRY_COLLECTED,
        createResourceEntry({
          duration: 100 as Duration,
          name: 'https://resource.com/valid',
          startTime: 1234 as RelativeTime,
        })
      )

      expect(rawRumEvents[0].startTime).toBe(1234)
      expect(rawRumEvents[0].rawRumEvent).toEqual({
        date: (jasmine.any(Number) as unknown) as TimeStamp,
        resource: {
          duration: (100 * 1e6) as ServerDuration,
          size: undefined,
          type: ResourceType.OTHER,
          url: 'https://resource.com/valid',
        },
        type: RumEventType.RESOURCE,
      })
    })

    it('should create resource from completed request', () => {
      const { lifeCycle, rawRumEvents } = setupBuilder.build()
      lifeCycle.notify(
        LifeCycleEventType.REQUEST_COMPLETED,
        createCompletedRequest({
          duration: 100 as Duration,
          method: 'GET',
          startClocks: { relative: 1234 as RelativeTime, timeStamp: 123456789 as TimeStamp },
          status: 200,
          type: RequestType.XHR,
          url: 'https://resource.com/valid',
        })
      )

      expect(rawRumEvents[0].startTime).toBe(1234)
      expect(rawRumEvents[0].rawRumEvent).toEqual({
        date: jasmine.any(Number),
        resource: {
          duration: (100 * 1e6) as ServerDuration,
          method: 'GET',
          status_code: 200,
          type: ResourceType.XHR,
          url: 'https://resource.com/valid',
        },
        type: RumEventType.RESOURCE,
      })
    })
  })

  describe('when resource tracking is disabled', () => {
    beforeEach(() => {
      setupBuilder = setup()
        .withSession({
          getId: () => '1234',
          isTracked: () => true,
          isTrackedWithResource: () => false,
        })
        .withConfiguration({
          isEnabled: () => true,
        })
        .beforeBuild(({ lifeCycle, session }) => {
          startResourceCollection(lifeCycle, session)
        })
    })

    afterEach(() => {
      setupBuilder.cleanup()
    })

    it('should not create resource from performance entry', () => {
      const { lifeCycle, rawRumEvents } = setupBuilder.build()
      lifeCycle.notify(LifeCycleEventType.PERFORMANCE_ENTRY_COLLECTED, createResourceEntry())

      expect(rawRumEvents.length).toBe(0)
    })

    it('should not create resource from completed request', () => {
      const { lifeCycle, rawRumEvents } = setupBuilder.build()
      lifeCycle.notify(LifeCycleEventType.REQUEST_COMPLETED, createCompletedRequest())

      expect(rawRumEvents.length).toBe(0)
    })
  })

  describe('when resource tracking change', () => {
    let isTrackedWithResource = true

    beforeEach(() => {
      setupBuilder = setup()
        .withSession({
          getId: () => '1234',
          isTracked: () => true,
          isTrackedWithResource: () => isTrackedWithResource,
        })
        .withConfiguration({
          isEnabled: () => true,
        })
        .beforeBuild(({ lifeCycle, session }) => {
          startResourceCollection(lifeCycle, session)
        })
    })

    afterEach(() => {
      setupBuilder.cleanup()
    })

    it('should enable/disable resource creation from performance entry', () => {
      const { lifeCycle, rawRumEvents } = setupBuilder.build()

      lifeCycle.notify(LifeCycleEventType.PERFORMANCE_ENTRY_COLLECTED, createResourceEntry())
      expect(rawRumEvents.length).toBe(1)

      isTrackedWithResource = false
      lifeCycle.notify(LifeCycleEventType.PERFORMANCE_ENTRY_COLLECTED, createResourceEntry())
      expect(rawRumEvents.length).toBe(1)

      isTrackedWithResource = true
      lifeCycle.notify(LifeCycleEventType.PERFORMANCE_ENTRY_COLLECTED, createResourceEntry())
      expect(rawRumEvents.length).toBe(2)
    })

    it('should enable/disable resource creation from completed request', () => {
      const { lifeCycle, rawRumEvents } = setupBuilder.build()

      lifeCycle.notify(LifeCycleEventType.REQUEST_COMPLETED, createCompletedRequest())
      expect(rawRumEvents.length).toBe(1)

      isTrackedWithResource = false
      lifeCycle.notify(LifeCycleEventType.REQUEST_COMPLETED, createCompletedRequest())
      expect(rawRumEvents.length).toBe(1)

      isTrackedWithResource = true
      lifeCycle.notify(LifeCycleEventType.REQUEST_COMPLETED, createCompletedRequest())
      expect(rawRumEvents.length).toBe(2)
    })
  })

  describe('tracing info', () => {
    beforeEach(() => {
      setupBuilder = setup()
        .withConfiguration({
          isEnabled: () => true,
        })
        .beforeBuild(({ lifeCycle, session }) => {
          startResourceCollection(lifeCycle, session)
        })
    })

    afterEach(() => {
      setupBuilder.cleanup()
    })

    it('should be processed from traced initial document', () => {
      const { lifeCycle, rawRumEvents } = setupBuilder.build()
      lifeCycle.notify(
        LifeCycleEventType.PERFORMANCE_ENTRY_COLLECTED,
        createResourceEntry({
          traceId: '1234',
        })
      )
      const traceInfo = (rawRumEvents[0].rawRumEvent as RawRumResourceEvent)._dd!
      expect(traceInfo).toBeDefined()
      expect(traceInfo.trace_id).toBe('1234')
    })

    it('should be processed from completed request', () => {
      const { lifeCycle, rawRumEvents } = setupBuilder.build()
      lifeCycle.notify(
        LifeCycleEventType.REQUEST_COMPLETED,
        createCompletedRequest({
          spanId: new TraceIdentifier(),
          traceId: new TraceIdentifier(),
        })
      )
      const traceInfo = (rawRumEvents[0].rawRumEvent as RawRumResourceEvent)._dd!
      expect(traceInfo).toBeDefined()
      expect(traceInfo.trace_id).toBeDefined()
      expect(traceInfo.span_id).toBeDefined()
    })
  })
})

function createCompletedRequest(details?: Partial<RequestCompleteEvent>): RequestCompleteEvent {
  const request: Partial<RequestCompleteEvent> = {
    duration: 100 as Duration,
    method: 'GET',
    startClocks: { relative: 1234 as RelativeTime, timeStamp: 123456789 as TimeStamp },
    status: 200,
    type: RequestType.XHR,
    url: 'https://resource.com/valid',
    ...details,
  }
  return request as RequestCompleteEvent
}
