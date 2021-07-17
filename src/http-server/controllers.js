const Stream = require('stream')
const path = require('path')
const { version } = require('../../package.json')
const RestQA = require('../../src')
const Remote = require('./services/remote')
const Report = require('./services/report')
const Project = require('./services/project')
const { URL } = require('url')
const Tips = require('../utils/tips')

module.exports = function (options, Service) {
  Service = Service || new Project()
  Service.options = options

  this.version = function (req, res) {
    res.json({ version })
  }

  this.config = function (req, res, next) {
    try {
      const result = Service.getConfig(req.app.get('restqa.configuration'))
      res.json(result)
    } catch (e) {
      next(e)
    }
  }

  this.steps = function (req, res, next) {
    try {
      const {
        keyword
      } = req.query

      const keywords = (keyword && [keyword]) || ['given', 'when', 'then']

      const result = keywords
        .map(keyword => {
          const options = {
            keyword,
            configFile: req.app.get('restqa.configuration')
          }
          return RestQA.Steps(options)
        })
        .flat()
        .map(item => ({
          plugin: item.Plugin,
          comment: item.Comment,
          step: item.Step,
          keyword: item.Keyword
        }))

      res.json(result)
    } catch (e) {
      next(e)
    }
  }

  this.initialize = async function (req, res, next) {
    try {
      const result = await RestQA.Initialize(req.body || {})
      res.json({
        configuration: result,
        folder: path.dirname(result)
      })
      req.app.set('restqa.configuration', result)
    } catch (e) {
      next(e)
    }
  }

  this.generate = async function (req, res, next) {
    try {
      const {
        cmd
      } = req.body

      const scenario = await RestQA.Generate(cmd)
      res.json({ scenario })
    } catch (e) {
      next(e)
    }
  }

  this.install = async function (req, res, next) {
    try {
      const options = req.body
      options.configFile = req.app.get('restqa.configuration')
      const config = await RestQA.Install(options)
      res
        .status(201)
        .json({ config })
    } catch (e) {
      next(e)
    }
  }

  this.run = async function (req, res, next) {
    try {
      const { server } = req.app.get('restqa.options')

      const options = req.body
      options.configFile = req.app.get('restqa.configuration')
      options.stream = new Stream.Writable()
      options.stream._write = () => {}
      options.path = path.resolve(server.testFolder, options.path || '')
      const result = await RestQA.Run(options)
      res
        .status(201)
        .json(result)
    } catch (e) {
      next(e)
    }
  }

  this.info = async function (req, res) {
    const result = await Remote.info()
    res.json(result)
  }

  this.createReports = async function (req, res, next) {
    try {
      const { server } = req.app.get('restqa.options')
      const outputFolder = server.report.outputFolder
      const result = await Report.create(outputFolder, req.body)
      result.url = new URL('http://foo.bar') // Sadly this class can't be instanciate without parameter so let me pass a fake one!
      result.url.protocol = req.protocol
      result.url.host = req.headers.host
      result.url.pathname = server.report.urlPrefixPath + '/' + result.id
      res
        .status(201)
        .json(result)
    } catch (e) {
      next(e)
    }
  }

  this.getReports = function (req, res, next) {
    try {
      const { server } = req.app.get('restqa.options')
      const outputFolder = server.report.outputFolder
      const list = Report.get(outputFolder)
        .map(item => {
          const result = {
            id: item.id,
            url: new URL('http://foo.bar') // Sadly this class can't be instanciate without parameter so let me pass a fake one!
          }
          result.url.protocol = req.protocol
          result.url.host = req.headers.host
          result.url.pathname = server.report.urlPrefixPath + '/' + item.id
          return result
        })
      res.json(list)
    } catch (e) {
      next(e)
    }
  }

  this.getFeatures = function (req, res, next) {
    const result = Service.getFeatures()
    res.json(result)
  }

  this.getFeaturesFile = function (req, res, next) {
    const file = req.params[0]
    try {
      const result = Service.getFeature(file)
      res.send(result)
    } catch (e) {
      let err = e
      if (e.code === 'ENOENT') {
        err = new RangeError(`The file "${file}" doesn't exist in the folder "${options.server.testFolder}"`)
      }
      next(err)
    }
  }

  this.updateFeaturesFile = function (req, res, next) {
    try {
      Service.updateFeature(req.params[0], req.body)
      res.sendStatus(204)
    } catch (e) {
      let err = e
      if (e.code === 'ENOENT') {
        err = new RangeError(`The file "${req.params[0]}" doesn't exist in the folder "${options.server.testFolder}"`)
      }
      next(err)
    }
  }

  this.tips = function (req, res) {
    const config = Service.getConfig(req.app.get('restqa.configuration'))

    const pattern = [
      '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
      '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
    ].join('|') // regex taken from the library https://github.com/chalk/ansi-regex in order to remove the bash coloration

    const tips = new Tips((config.restqa || {}).tips)
    res.json({
      message: tips.toString().replace(new RegExp(pattern, 'g'), '')
    })
  }

  this.preferences = function (req, res) {
    const result = Service.getPreferences()
    res.json(result)
  }

  return this
}
