'use strict'

var _ = require('../util/_')
var BN = require('../crypto/bn')
var JSUtil = require('../util/js')
var BufferWriter = require('../encoding/bufferwriter')
var Varint = require('../encoding/varint')
var Script = require('../script')
var $ = require('../util/preconditions')
var errors = require('../errors')

var MAX_SAFE_INTEGER = 0x1fffffffffffff

function Output (args) {
  if (!(this instanceof Output)) {
    return new Output(args)
  }
  if (_.isObject(args)) {
    this.satoshis = args.satoshis
    if (Buffer.isBuffer(args.script)) {
      this.setScriptFromBuffer(args.script)
    } else {
      var script
      if (_.isString(args.script) && JSUtil.isHexa(args.script)) {
        script = Buffer.from(args.script, 'hex')
      } else {
        script = args.script
      }
      this.setScript(script)
    }
  } else {
    throw new TypeError('Unrecognized argument for Output')
  }
}

Object.defineProperty(Output.prototype, 'script', {
  configurable: false,
  enumerable: true,
  get: function () {
    return this._script
  }
})

Object.defineProperty(Output.prototype, 'satoshis', {
  configurable: false,
  enumerable: true,
  get: function () {
    return this._satoshis
  },
  set: function (num) {
    if (num instanceof BN) {
      this._satoshisBN = num
      this._satoshis = num.toNumber()
    } else if (_.isString(num)) {
      this._satoshis = parseInt(num)
      this._satoshisBN = BN.fromNumber(this._satoshis)
    } else {
      $.checkArgument(
        JSUtil.isNaturalNumber(num),
        'Output satoshis is not a natural number'
      )
      this._satoshisBN = BN.fromNumber(num)
      this._satoshis = num
    }
    $.checkState(
      JSUtil.isNaturalNumber(this._satoshis),
      'Output satoshis is not a natural number'
    )
  }
})

Output.prototype.invalidSatoshis = function () {
  if (this._satoshis > MAX_SAFE_INTEGER) {
    return 'transaction txout satoshis greater than max safe integer'
  }
  if (this._satoshis !== this._satoshisBN.toNumber()) {
    return 'transaction txout satoshis has corrupted value'
  }
  if (this._satoshis < 0) {
    return 'transaction txout negative'
  }
  return false
}

Object.defineProperty(Output.prototype, 'satoshisBN', {
  configurable: false,
  enumerable: true,
  get: function () {
    return this._satoshisBN
  },
  set: function (num) {
    this._satoshisBN = num
    this._satoshis = num.toNumber()
    $.checkState(
      JSUtil.isNaturalNumber(this._satoshis),
      'Output satoshis is not a natural number'
    )
  }
})

Output.prototype.toObject = Output.prototype.toJSON = function toObject () {
  var obj = {
    satoshis: this.satoshis
  }
  obj.script = this._script.toBuffer().toString('hex')
  return obj
}

Output.fromObject = function (data) {
  return new Output(data)
}

Output.prototype.setScriptFromBuffer = function (buffer) {
  try {
    this._script = Script.fromBuffer(buffer)
    this._script._isOutput = true
  } catch (e) {
    if (e instanceof errors.Script.InvalidBuffer) {
      this._script = null
    } else {
      throw e
    }
  }
}

Output.prototype.setScript = function (script) {
  if (script instanceof Script) {
    this._script = script
    this._script._isOutput = true
  } else if (_.isString(script)) {
    this._script = Script.fromString(script)
    this._script._isOutput = true
  } else if (Buffer.isBuffer(script)) {
    this.setScriptFromBuffer(script)
  } else {
    throw new TypeError('Invalid argument type: script')
  }
  return this
}

Output.prototype.inspect = function () {
  var scriptStr
  if (this.script) {
    scriptStr = this.script.inspect()
  }
  return '<Output (' + this.satoshis + ' sats) ' + scriptStr + '>'
}

Output.fromBufferReader = function (br) {
  var obj = {}
  obj.satoshis = br.readUInt64LEBN()
  var size = br.readVarintNum()
  if (size !== 0) {
    if (br.remaining() < size) {
      throw new TypeError('Unrecognized Output')
    }
    obj.script = br.read(size)
  } else {
    obj.script = Buffer.from([])
  }
  return new Output(obj)
}

Output.prototype.toBufferWriter = function (writer) {
  if (!writer) {
    writer = new BufferWriter()
  }
  writer.writeUInt64LEBN(this._satoshisBN)
  var script = this._script.toBuffer()
  writer.writeVarintNum(script.length)
  writer.write(script)
  return writer
}

// 8    value
// ???  script size (VARINT)
// ???  script
Output.prototype.getSize = function () {
  var scriptSize = this.script.toBuffer().length
  var varintSize = Varint(scriptSize).toBuffer().length
  return 8 + varintSize + scriptSize
}

module.exports = Output
