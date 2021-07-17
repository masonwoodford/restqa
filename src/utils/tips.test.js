const chalk = require('chalk')
const got = require('got')

const jestqa = new JestQA(__filename, true)

beforeEach(jestqa.beforeEach)

describe('# utils - tips', () => {
  const Tips = require('./tips')

  test('Share a tips message if the flag is set to true and 1 message is passed', () => {
    const config = {
      enabled: true,
      messages: [
        chalk.bold.green('Hello my friend')
      ]
    }
    const result = new Tips(config)
    expect(result.text).toEqual(chalk.bold.green('Hello my friend'))
  })

  test('Share a random tips message if the flag is set to true and multiple message is passed', () => {
    const config = {
      enabled: true,
      messages: Array(1000).fill(0).map((_, i) => {
        return chalk.bold.green(`Hello my friend ${i}`)
      })
    }

    const result1 = new Tips(config) // First call
    const result2 = new Tips(config) // Second call to test randomnes Normally, the result should be different

    expect(config.messages).toEqual(expect.arrayContaining([result1.text]))
    expect(config.messages).toEqual(expect.arrayContaining([result2.text]))

    expect(result1.text).not.toEqual(result2.text) // The first result should be different to the second result in order to validate the randomness
  })

  test('Do not  Share a tips message if the flag is set to false', () => {
    const config = {
      enabled: false,
      messages: [
        chalk.bold.green('Hello my friend')
      ]
    }
    const { text } = new Tips(config)

    expect(text).toBeFalsy()
  })

  test('Share the default Messages if no messages has been passed into the config', () => {
    const config = {
      enabled: true
    }
    const result = new Tips(config)

    expect(result.text).not.toBeUndefined()
  })

  test('Share the default Messages if messages passed are empty into the config', () => {
    const config = {
      enabled: true,
      message: []
    }
    const result = new Tips(config)

    expect(result.text).not.toBeUndefined()
  })

  test('Share the default Messages no config is passed', () => {
    const result = new Tips()

    expect(result.text).not.toBeUndefined()
  })
})

test('Detect broken link from the messages', async () => {
  const ignoreList = [
    'https://linkedin.com/company/restqa',
    'https://restqa.io/pair'
  ]
  const mockYellow = jest.fn()
  jest.mock('chalk', () => {
    return {
      yellow: mockYellow,
      red: jest.fn(),
      blue: jest.fn(),
      green: jest.fn()
    }
  })
  require('./tips')

  const list = mockYellow.mock.calls.filter(p => !ignoreList.includes(p[0])).flat()

  for (const url of list) {
    try {
      await expect(got(url, { timeout: 2000 })).resolves.not.toBeUndefined()
    } catch (err) {
      throw new Error(`${url}: ${err.message}`)
    }
  }
}, 100000)
