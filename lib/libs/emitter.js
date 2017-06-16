'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = Emitter;

var _events = require('events');

function Emitter() {
  return new _events.EventEmitter();
}
module.exports = exports['default'];