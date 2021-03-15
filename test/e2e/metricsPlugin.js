const WDIOReporter = require('@wdio/reporter').default
const StatsD = require('hot-shots')

module.exports = class CustomReporter extends WDIOReporter {
  onRunnerStart() {
    this.dogstatsd = new StatsD({
      globalTags: [],
    })
  }

  onTestPass(test) {
    const tags = []
    this.dogstatsd.increment('browser-sdk.e2e.spec.success', tags)
  }

  onTestFail(test) {
    const tags = []
    this.dogstatsd.increment('browser-sdk.e2e.spec.failure', tags)
  }

  onTestSkip(test) {
    const tags = []
    this.dogstatsd.increment('browser-sdk.e2e.spec.skipped', tags)
  }
}
