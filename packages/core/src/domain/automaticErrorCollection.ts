import { FetchCompleteContext, resetFetchProxy, startFetchProxy } from '../browser/fetchProxy'
import { resetXhrProxy, startXhrProxy, XhrCompleteContext } from '../browser/xhrProxy'
import { ErrorSource, formatUnknownError, RawError, toStackTraceString, formatErrorMessage } from '../tools/error'
import { Observable } from '../tools/observable'
import { clocksNow } from '../tools/timeUtils'
import { jsonStringify, RequestType, find } from '../tools/utils'
import { Configuration } from './configuration'
import { monitor } from './internalMonitoring'
import { computeStackTrace, subscribe, unsubscribe, StackTrace } from './tracekit'

export type ErrorObservable = Observable<RawError>
let errorObservable: ErrorObservable

export function startAutomaticErrorCollection(configuration: Configuration) {
  if (!errorObservable) {
    errorObservable = new Observable<RawError>()
    trackNetworkError(configuration, errorObservable)
    startConsoleTracking(errorObservable)
    startRuntimeErrorTracking(errorObservable)
  }
  return errorObservable
}

let originalConsoleError: (...params: unknown[]) => void

/* eslint-disable no-console */
export function startConsoleTracking(errorObservable: ErrorObservable) {
  originalConsoleError = console.error
  console.error = monitor((...params: unknown[]) => {
    originalConsoleError.apply(console, params)
    errorObservable.notify({
      ...buildErrorFromParams(params),
      source: ErrorSource.CONSOLE,
      startClocks: clocksNow(),
    })
  })
}

export function stopConsoleTracking() {
  console.error = originalConsoleError
}
/* eslint-enable no-console */

function buildErrorFromParams(params: unknown[]) {
  const firstErrorParam = find(params, (param: unknown): param is Error => param instanceof Error)
  return {
    message: ['console error:', ...params].map((param) => formatConsoleParameters(param)).join(' '),
    stack: firstErrorParam ? toStackTraceString(computeStackTrace(firstErrorParam)) : undefined,
  }
}

function formatConsoleParameters(param: unknown) {
  if (typeof param === 'string') {
    return param
  }
  if (param instanceof Error) {
    return formatErrorMessage(computeStackTrace(param))
  }
  return jsonStringify(param, undefined, 2)
}

let traceKitReportHandler: (stack: StackTrace, isWindowError: boolean, errorObject?: any) => void

export function startRuntimeErrorTracking(errorObservable: ErrorObservable) {
  traceKitReportHandler = (stackTrace: StackTrace, _: boolean, errorObject?: any) => {
    const { stack, message, type } = formatUnknownError(stackTrace, errorObject, 'Uncaught')
    errorObservable.notify({
      message,
      stack,
      type,
      source: ErrorSource.SOURCE,
      startClocks: clocksNow(),
    })
  }
  subscribe(traceKitReportHandler)
}

export function stopRuntimeErrorTracking() {
  unsubscribe(traceKitReportHandler)
}

export function trackNetworkError(configuration: Configuration, errorObservable: ErrorObservable) {
  startXhrProxy().onRequestComplete((context) => handleCompleteRequest(RequestType.XHR, context))
  startFetchProxy().onRequestComplete((context) => handleCompleteRequest(RequestType.FETCH, context))

  function handleCompleteRequest(type: RequestType, request: XhrCompleteContext | FetchCompleteContext) {
    if (
      !configuration.isIntakeUrl(request.url) &&
      (!configuration.isEnabled('remove-network-errors') || !request.isAborted) &&
      (isRejected(request) || isServerError(request))
    ) {
      errorObservable.notify({
        message: `${format(type)} error ${request.method} ${request.url}`,
        resource: {
          method: request.method,
          statusCode: request.status,
          url: request.url,
        },
        source: ErrorSource.NETWORK,
        stack: truncateResponse(request.response, configuration) || 'Failed to load',
        startClocks: request.startClocks,
      })
    }
  }

  return {
    stop: () => {
      resetXhrProxy()
      resetFetchProxy()
    },
  }
}

function isRejected(request: { status: number; responseType?: string }) {
  return request.status === 0 && request.responseType !== 'opaque'
}

function isServerError(request: { status: number }) {
  return request.status >= 500
}

function truncateResponse(response: string | undefined, configuration: Configuration) {
  if (response && response.length > configuration.requestErrorResponseLengthLimit) {
    return `${response.substring(0, configuration.requestErrorResponseLengthLimit)}...`
  }
  return response
}

function format(type: RequestType) {
  if (RequestType.XHR === type) {
    return 'XHR'
  }
  return 'Fetch'
}
