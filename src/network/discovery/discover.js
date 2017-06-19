// import * as util from 'util';
import Emitter from '@libs/emitter';
import Network from './network';

// const reservedEvents = ['promotion', 'demotion', 'added', 'removed', 'master', 'hello'];
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


export default async function Discover(options = defaultOptions) {
  const emitter = Emitter();
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

  self.broadcast = Network(opts);

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

    Object.getOwnPropertyNames(data).forEach((key) => {
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
        let masterCount = (self.me.isMaster) ? 1 : 0;
        Object.keys(self.nodes).forEach((uuid) => {
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
}

function weight() {
  const now = Date.now();
  return -(now / (10 ** String(now).length));
}
