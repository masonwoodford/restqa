const YAML = require('yaml')
const fs = require('fs')
const path = require('path')
const inquirer = require('inquirer')
const Generate = require('./generate')
const logger = require('../utils/logger')

const WELCOME_API_URL = 'https://restqa.io/welcome.json'

async function initialize (program) {
  let answers = {
    name: 'app',
    url: 'https://api.restqa.io',
    env: 'local',
    description: 'Configuration generated by restqa init'
  }

  if (program.y !== true) {
    const questions = [{
      type: 'input',
      name: 'name',
      default: answers.name,
      message: 'Project name:'
    }, {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: answers.description
    }, {
      type: 'input',
      name: 'url',
      message: 'Url of the project api:',
      default: answers.url
    }, {
      type: 'input',
      name: 'env',
      message: 'Environment name of this url (local) ?',
      default: answers.env
    }, {
      type: 'list',
      name: 'ci',
      message: 'Do you need a continuous integration configuration ?',
      default: false,
      choices: [{
        name: 'Github Action',
        value: 'github-action'
      }, {
        name: 'Gitlab Ci',
        value: 'gitlab-ci'
      }, {
        name: 'Bitbucket Pipelines',
        value: 'bitbucket-pipeline'
      }, {
        name: 'Circle Ci',
        value: 'circle-ci'
      }, {
        name: 'Travis Ci',
        value: 'travis'
      },
      new inquirer.Separator(),
      {
        name: 'I want to configure the continuous integration by myself',
        value: false
      }]
    }]
    answers = await inquirer.prompt(questions)
  }
  return initialize.generate(answers)
}

initialize.generate = async function (options) {
  options.folder = options.folder || process.cwd()

  const {
    ci,
    name,
    url,
    env,
    description,
    folder
  } = options

  if (!name) {
    throw new Error('Please share a project name.')
  }

  if (!description) {
    throw new Error('Please share a project description.')
  }

  if (!url) {
    throw new Error('Please share a project url.')
  }

  if (!env) {
    throw new Error('Please share a project url environment.')
  }

  const restqaConfig = {
    version: '0.0.1',
    metadata: {
      code: name.replace(/[^A-Z0-9]+/ig, '-').toUpperCase(),
      name,
      description
    },
    environments: [{
      name: env,
      default: true,
      plugins: [{
        name: '@restqa/restqapi',
        config: {
          url
        }
      }],
      outputs: [{
        type: 'html',
        enabled: true
      }, {
        type: 'file',
        enabled: true,
        config: {
          path: 'restqa-result.json'
        }
      }]
    }]
  }

  createYaml(path.resolve(folder, '.restqa.yml'), restqaConfig)

  logger.success('service.init.success.welcome')

  if (ci) {
    switch (ci) {
      case 'github-action': {
        const jsonContent = {
          name: 'RestQA - Integration tests',
          on: [
            'push'
          ],
          jobs: {
            RestQa: {
              'runs-on': 'ubuntu-latest',
              steps: [{
                uses: 'actions/checkout@v1'
              }, {
                uses: 'restqa/restqa-action@0.0.1',
                with: {
                  path: 'tests/'
                }
              }, {
                name: 'RestQA Report',
                uses: 'actions/upload-artifact@v2',
                with: {
                  name: 'restqa-report',
                  path: 'report'
                }
              }]
            }
          }
        }

        const filename = '.github/workflows/integration-test.yml'
        createRecursiveFolder(filename, folder)
        createYaml(path.resolve(folder, filename), jsonContent)

        logger.success('service.init.success.ci', 'Github Action')
        break
      }
      case 'gitlab-ci': {
        const jsonContent = {
          stages: [
            'e2e test'
          ],
          RestQa: {
            stage: 'e2e test',
            image: {
              name: 'restqa/restqa'
            },
            script: [
              'restqa run .'
            ],
            artifacts: {
              paths: [
                'report'
              ]
            }
          }
        }
        createYaml(path.resolve(folder, '.gitlab-ci.yml'), jsonContent)
        logger.success('service.init.success.ci', 'Gitlab CI')
        break
      }
      case 'bitbucket-pipeline': {
        const jsonContent = {
          pipelines: {
            default: [{
              step: {
                image: 'restqa/restqa',
                script: [
                  'restqa run .'
                ],
                artifacts: [
                  'report/**'
                ]
              }
            }]
          }
        }
        createYaml(path.resolve(folder, 'bitbucket-pipelines.yml'), jsonContent)
        logger.success('service.init.success.ci', 'Bitbucket Pipeline')
        break
      }
      case 'circle-ci': {
        const jsonContent = {
          version: 2.1,
          jobs: {
            test: {
              docker: [
                {
                  image: 'restqa/restqa'
                }
              ],
              steps: [
                'checkout',
                {
                  run: {
                    name: 'Run RestQA integration test',
                    command: 'restqa run'
                  }
                },
                {
                  store_artifacts: {
                    path: 'report'
                  }
                }
              ]
            }
          },
          workflows: {
            version: 2,
            restqa: {
              jobs: [
                'test'
              ]
            }
          }
        }
        const filename = '.circleci/config.yml'
        createRecursiveFolder(filename, folder)
        createYaml(path.resolve(folder, filename), jsonContent)

        logger.success('service.init.success.ci', 'Circle CI')
        break
      }
      case 'travis': {
        const jsonContent = {
          dist: 'trusty',
          jobs: {
            include: [
              {
                stage: 'test',
                script: 'docker run --rm -v $PWD:/app restqa/restqa'
              }
            ]
          }
        }
        const filename = '.travis.yml'
        createRecursiveFolder(filename, folder)
        createYaml(path.resolve(folder, filename), jsonContent)

        logger.success('service.init.success.ci', 'Travis CI')
        break
      }
      default:
        throw new Error(`The continous integration "${ci}" is not supported by RestQa`)
    }
  }

  try {
    const curl = ['curl', WELCOME_API_URL]

    const response = await Generate({ args: curl, print: false })

    const output = 'tests/integration/welcome-restqa.feature'

    createRecursiveFolder(output, folder)

    const content = [
      'Feature: Welcome to the RestQA community',
      '',
      'Scenario: Get the list of useful RestQA resources',
      response
    ]

    fs.writeFileSync(path.resolve(folder, output), content.join('\n'))

    logger.info('service.init.success.sample')
  } catch (err) {
    logger.log('service.init.error.scenario_generation', WELCOME_API_URL)
  }
  logger.log('service.init.success.info')
}

function createYaml (filename, jsonContent) {
  const contentYAML = YAML.stringify(jsonContent, null, { directivesEndMarker: true })
  fs.writeFileSync(filename, contentYAML)
}

function createRecursiveFolder (filename, root) {
  fs.mkdirSync(path.resolve(root, path.dirname(filename)), { recursive: true })
}

module.exports = initialize
