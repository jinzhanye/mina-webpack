const sfc = require('@tinajs/mina-sfc')

function parse (source) {
  const blocks = sfc.parse(source)

  return {
    style: blocks.style,
    config: blocks.config,
    script: blocks.script,
    template: blocks.template,
  }
}

// 将 .mina 文件转换成 'module.exports={config:{},template:'',script:'',style:''}'
module.exports = function (source) {
  return 'module.exports = ' + JSON.stringify(parse(source))
}
