const path = require('path')
const merge = require('lodash.merge')
const compose = require('compose-function')
const loaderUtils = require('loader-utils')
const resolveFrom = require('resolve-from')
const ensurePosix = require('ensure-posix-path')

const selectorLoaderPath = require.resolve('./selector')
const parserLoaderPath = require.resolve('./parser')
const minaJSONFileLoaderPath = require.resolve('./mina-json-file')

const resolve = (module) => require.resolve(module)

const helpers = require('../helpers')

const LOADERS = {
  template: ({ publicPath }) => `${resolve('wxml-loader')}?${JSON.stringify({ publicPath })}`,
  style: ({ publicPath }) => `${resolve('extract-loader')}?${JSON.stringify({ publicPath })}!${resolve('css-loader')}`,
  script: () => '',
  config: ({ publicPath }) => `${minaJSONFileLoaderPath}?${JSON.stringify({ publicPath })}`,
}

const EXTNAMES = {
  template: 'wxml',
  style: 'wxss',
  script: 'js',
  config: 'json',
}

const TYPES_FOR_FILE_LOADER = ['template', 'style', 'config']
const TYPES_FOR_OUTPUT = ['script']

module.exports = function () {
  this.cacheable()

  const done = this.async()
  const options = merge({}, {
    loaders: {},
    publicPath: this.options.output.publicPath,
  }, loaderUtils.getOptions(this) || {})

  // 获取剩余请求资源的路径，也就是 xx.mina 的路径
  // 例如 /Users/jinzhanye/Desktop/dev/github/mini/mina-webpack/example/src/app.mina
  const url = loaderUtils.getRemainingRequest(this)

  // 前置 !! 表示只执行行内 loader，其他 loader 都不执行
  // 拼接上 parserLoader 的路径
  const parsedUrl = `!!${parserLoaderPath}!${url}`

  const loadModule = helpers.loadModule.bind(this)

  const getLoaderOf = (type, options) => {
    let loader = LOADERS[type](options) || ''
    // append custom loader
    let custom = options.loaders[type] || ''
    if (custom) {
      custom = helpers.stringifyLoaders(helpers.parseLoaders(custom).map((object) => {
        return merge({}, object, {
          loader: resolveFrom(this.options.context, object.loader),
        })
      }))
      loader = loader ? `${loader}!${custom}` : custom
    }
    // add '!' at the end
    if (loader) {
      loader += '!'
    }
    return loader
  }

  loadModule(parsedUrl)
    .then((source) => {
      let parts = this.exec(source, parsedUrl)
      // parts 为以下对象
      // {
      //   config: {
      //     content: '.....'
      //   }
      //   wxml: {
      //     content: '.....'
      //   }
      //
      // }

      // compute output
      // 拼接 selector loader 路径
      // require("!!../node_modules/@tinajs/mina-loader/lib/loaders/selector.js?type=script!./app.mina")
      let output = parts.script && parts.script.content ?
        TYPES_FOR_OUTPUT.map((type) => `require(${loaderUtils.stringifyRequest(this, `!!${getLoaderOf(type, options)}${selectorLoaderPath}?type=script!${url}`)})`).join(';') :
        ''

      return Promise
        // emit files
        .all(TYPES_FOR_FILE_LOADER.map((type) => {
          if (!parts[type] || !parts[type].content) {
            return Promise.resolve()
          }
          // dirname 为 '.'
          let dirname = compose(ensurePosix, helpers.toSafeOutputPath, path.dirname)(path.relative(this.options.context, url))
          // 拼接 wxml、json、wxss 请求路径
          let request = `!!${resolve('file-loader')}?name=${dirname}/[name].${EXTNAMES[type]}!${getLoaderOf(type, options)}${selectorLoaderPath}?type=${type}!${url}`
          return loadModule(request)
        }))
        .then(() => done(null, output))
    })
    .catch(done)
}
