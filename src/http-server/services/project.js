const glob = require('glob')
const path = require('path')
const fs = require('fs')
const os = require('os')
const YAML = require('yaml')

class Project {
  set options (val) {
    this._options = val
  }

  get options () {
    return this._options
  }

  set configFile (val) {
    this._configFile = val
  }

  get configFile () {
    return this._configFile
  }

  get server () {
    return (this._options || {}).server || {}
  }

  getFeatures () {
    const pattern = path.join('.', '{*.feature,!(node_modules)', '**', '*.feature}')
    return glob.sync(pattern, { cwd: this.server.testFolder })
  }

  getConfig (filename) {
    const content = fs.readFileSync(filename).toString('utf-8')
    return YAML.parse(content)
  }

  getPreferences () {
    const filepath = path.resolve(os.homedir(), '.config', 'restqa.pref')
    let content = '{}'
    if (fs.existsSync(filepath)) {
      content = fs.readFileSync(filepath, 'utf-8')
    }
    return JSON.parse(content)
  }

  getFeature (file) {
    return fs.readFileSync(path.resolve(this.server.testFolder, file)).toString('utf-8')
  }

  updateFeature (file, content) {
    const filepath = path.resolve(this.server.testFolder, file)
    if (!fs.existsSync(filepath)) {
      const e = new Error('')
      e.code = 'ENOENT'
      throw e
    }
    fs.writeFileSync(filepath, content)
  }
}

module.exports = Project
