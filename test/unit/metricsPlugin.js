const StatsD = require('hot-shots')

function metricsReporter() {
  this.onBrowserStart = (browser) => {
    const [, browserName, browserVersion, os] = /([^\d+]+) ([\d\.]+) \((.*)\)/.exec(browser.name)
    this.dogstatsd = new StatsD({
      globalTags: [`browser_name:${browserName}`, `browser_version:${browserVersion}`, `os:${os}`],
    })
  }

  this.onSpecComplete = (_, result) => {
    const tags = [`suite:${normalizeName(result.suite.join(' '))}`, `spec:${normalizeName(result.fullName)}`]
    if (result.skipped) {
      this.dogstatsd.increment('browser-sdk.unit.spec.skipped', tags)
    } else if (result.success) {
      this.dogstatsd.increment('browser-sdk.unit.spec.success', tags)
    } else {
      this.dogstatsd.increment('browser-sdk.unit.spec.failure', tags)
    }
  }
}

function normalizeName(name) {
  return name.replace(/[\s,:]/g, '_')
}

metricsReporter.$inject = ['logger']

module.exports = {
  'reporter:metrics': ['type', metricsReporter],
}
