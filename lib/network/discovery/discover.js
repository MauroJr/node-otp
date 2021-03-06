'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = Discover;

var _emitter = require('../../libs/emitter');

var _emitter2 = _interopRequireDefault(_emitter);

var _network = require('./network');

var _network2 = _interopRequireDefault(_network);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import * as util from 'util';
const reservedEvents = ['promotion', 'demotion', 'added', 'removed', 'master', 'hello'];
const defaultOptions = {
  helloInterval: 1000,
  checkInterval: 2000,
  nodeTimeout: 2000,
  masterTimeout: 2000,
  mastersRequired: 1,
  weight: weight(),
  client: false,
  server: false,
  address: '0.0.0.0',
  port: 11777,
  broadcast: undefined,
  multicast: undefined,
  multicastTTL: 1,
  unicast: undefined,
  key: undefined,
  reuseAddr: true,
  ignoreProcess: true,
  ignoreInstance: true,
  advertisement: undefined
};

function Discover(options = defaultOptions, done) {
  const emitter = (0, _emitter2.default)();
  const opts = Object.assign({}, defaultOptions, options);
  const self = Object.assign({}, opts, {
    emit: emitter.emit.bind(emitter),
    nodes: {},
    channels: [],
    running: false,
    checkId: undefined,
    helloId: undefined
  });

  if (!(self.nodeTimeout >= self.checkInterval)) {
    throw new Error('nodeTimeout must be greater than or equal to checkInterval.');
  }

  if (!(self.masterTimeout >= self.nodeTimeout)) {
    throw new Error('masterTimeout must be greater than or equal to nodeTimeout.');
  }

  self.broadcast = (0, _network2.default)(opts);

  // This is the object that gets broadcast with each hello packet.
  self.me = {
    isMaster: false,
    isMasterEligible: self.server, // Only master eligible by default if we are a server
    weight: self.weight,
    address: '127.0.0.1', // TODO: get the real local address?
    advertisement: self.advertisement
  };

  /*
   *  - make sure the node is in the node list
   *   - if hello is from new node, emit added
   *   - if hello is from new master and we are master, demote
   *   - if hello is from new master emit master
   *
   * need to be careful not to over-write the old node object before we have information
   * about the old instance to determine if node was previously a master.
   */
  self.evaluateHello = (data, obj, rinfo) => {
    // prevent processing hello message from self
    if (obj.iid === self.broadcast.instanceUuid) {
      return;
    }

    data.lastSeen = Date.now();
    data.address = rinfo.address;
    data.hostName = obj.hostName;
    data.port = rinfo.port;
    data.id = obj.iid;

    let node = self.nodes[obj.iid];
    const isNew = !node;
    let wasMaster;

    if (!isNew) {
      wasMaster = !!node.isMaster;
    }

    node = node || {};

    Object.getOwnPropertyNames(data).forEach(key => {
      node[key] = data[key];
    });

    if (isNew) {
      // new node found

      self.emit('added', node, obj, rinfo);
    }

    self.emit('helloReceived', node);

    if (node.isMaster) {
      // if we have this node and it was not previously a master then it is a new master node
      if (isNew || !wasMaster) {
        // this is a new master

        // count up how many masters we have now
        // initialze to 1 if we are a master
        let masterCount = self.me.isMaster ? 1 : 0;
        Object.keys(self.nodes).forEach(uuid => {
          if (self.nodes[uuid].isMaster) {
            masterCount += 1;
          }
        });

        if (self.me.isMaster && masterCount > opts.mastersRequired) {
          self.demote();
        }

        self.emit('master', node, obj, rinfo);
      }
    }
  };

  self.broadcast.on('hello', self.evaluateHello);

  self.broadcast.on('error', error => {
    self.emit('error', error);
  });

  self.check = () => {
    let removed;
    let mastersFound = 0;
    let higherWeightFound = false;

    const nodes = self.nodes;

    Object.keys(nodes).forEach(uuid => {
      const node = nodes[uuid];
      const deltaTime = Date.now() - node.lastSeen;

      removed = false;

      if (deltaTime > opts.nodeTimeout) {
        // we haven't seen the node recently

        // If node is a master and has not timed out yet based on the masterTimeout
        // then fake it being found
        if (node.isMaster && deltaTime < opts.masterTimeout) {
          mastersFound += 1;
        }

        // delete the node from our nodes list
        delete self.nodes[uuid];
        removed = true;
        self.emit('removed', node);
      } else if (node.isMaster) {
        mastersFound += 1;
      }

      if (node.weight > self.me.weight && node.isMasterEligible && !node.isMaster && !removed) {
        higherWeightFound = true;
      }
    });

    if (!self.me.isMaster && mastersFound < opts.mastersRequired && self.me.isMasterEligible && !higherWeightFound) {
      // no masters found out of all our nodes, become one.
      promote(self);
    }
  };

  self.start = callback => {
    if (self.running) {
      if (callback) {
        callback(undefined, false);
      }

      return false;
    }

    self.broadcast.start(err => {
      if (err) {
        return callback && callback(err, false);
      }

      self.running = true;

      self.checkId = setInterval(self.check, checkInterval());

      if (self.server) {
        // send hello every helloInterval
        self.helloId = setInterval(() => {
          hello(self);
        }, helloInterval());
      }

      return callback && callback(null, true);
    });

    self.stop = () => {
      if (!self.running) {
        return false;
      }

      self.broadcast.stop();

      clearInterval(self.checkId);
      clearInterval(self.helloId);

      self.running = false;
    };

    self.start(done);

    function helloInterval() {
      if (typeof self.helloInterval === 'function') {
        return self.helloInterval(self);
      }

      return self.helloInterval;
    }

    function checkInterval() {
      if (typeof self.checkInterval === 'function') {
        return self.checkInterval(self);
      }

      return self.checkInterval;
    }

    return Object.freeze({
      promote,
      hello,
      advertise,
      eachNode,
      join,
      send,
      leave
    });
  };
}

function promote(self) {
  self.me.isMasterEligible = true;
  self.me.isMaster = true;
  self.emit('promotion', self.me);
  hello(self);
}

function hello(self) {
  self.broadcast.send('hello', self.me);
  self.emit('helloEmitted');
}

function advertise(self, obj) {
  self.me.advertisement = obj;
}

function eachNode(self, fn) {
  const nodes = self.nodes;

  Object.keys(nodes).forEach(uuid => {
    fn(nodes[uuid]);
  });
}

function join(self, channel, fn) {
  if (reservedEvents.indexOf(channel) !== -1) {
    return false;
  }

  if (self.channels.indexOf(channel) !== -1) {
    return false;
  }

  if (fn) {
    self.on(channel, fn);
  }

  self.broadcast.on(channel, (data, obj, rinfo) => {
    self.emit(channel, data, obj, rinfo);
  });

  self.channels.push(channel);

  return true;
}

function leave(self, channel) {
  self.broadcast.removeAllListeners(channel);

  delete self.channels[self.channels.indexOf(channel)];

  return true;
}

function send(self, channel, obj) {
  if (reservedEvents.indexOf(channel) !== -1) {
    return false;
  }

  self.broadcast.send(channel, obj);

  return true;
}

function weight() {
  const now = Date.now();
  return -(now / 10 ** String(now).length);
}
module.exports = exports['default'];