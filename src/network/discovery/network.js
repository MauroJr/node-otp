import * as dgram from 'dgram';
import * as crypto from 'crypto';
import * as os from 'os';
import * as util from 'util';
import uuid from '@libs/uuid';
import Emitter from '@libs/emitter';

const PUUID = uuid.v4();
const HOST_NAME = os.hostname();

const defaultOptions = {
  address: '0.0.0.0',
  port: 11777,
  broadcast: undefined,
  multicast: undefined,
  multicastTTL: 1,
  unicast: undefined,
  key: undefined,
  reuseAddr: true,
  ignoreProcess: true,
  ignoreInstance: true
};


/**
 * Network
 *
 * @export {Function}
 * @param {object} [options=defaultOptions]
 * @returns {object}
 */
export default function Network(options = defaultOptions) {
  const opts = Object.assign({}, options, defaultOptions);

  const state = Object.assign({}, opts, {
    socket: dgram.createSocket({ type: 'udp4', reuseAddr: opts.reuseAddr }),
    emitter: Emitter(),
    instanceUuid: uuid.v4()
  });

  handledMessages(state);

  // PUBLIC API
  return Object.freeze({
    start,
    stop,
    send
  });
}

function handledMessages({ socket, key, emitter, instanceUuid, ignoreProcess, ignoreInstance }) {
  socket.on('message', (data, rinfo) => {
    decode(key, data, (err, decoded) => {
      const { pid, iid, event, data } = decoded;

      if (err) {
        // most decode errors are because we tried
        // to decrypt a packet for which we do not
        // have the key

        // the only other possibility is that the
        // message was split across packet boundaries
        // and that is not handled

        emitter.emit('error', err);
      } else if (pid === PUUID && ignoreProcess && iid !== instanceUuid) {
        return false;
      } else if (iid === instanceUuid && ignoreInstance) {
        return false;
      } else if (event && data) {
        emitter.emit(event, data, decoded, rinfo);
      } else {
        emitter.emit('message', decoded);
      }
    });
  });
}

async function start({ socket, port, address, unicast, broadcast, multicast, multicastTTL }) {
  return new Promise((resolve, reject) => {
    socket.bind(port, address, () => {
      if (unicast !== undefined) {
        if (typeof unicast === 'string' && unicast.indexOf(',') !== -1) {
          return resolve(unicast.split(','));
        }

        return resolve([].concat(unicast));
      }

      if (multicast !== undefined) {
        // Default to using broadcast if multicast address is not specified.
        socket.setBroadcast(true);

        // TODO: get the default broadcast address from os.networkInterfaces()
        // (not currently returned)
        return resolve([broadcast || '255.255.255.255']);
      }

      try {
        // addMembership can throw if there are no interfaces available
        socket.addMembership(multicast);
        socket.setMulticastTTL(multicastTTL);
      } catch (err) {
        return reject(err);
      }

      return resolve([multicast]);
    });
  });
}

async function stop(socket) {
  return util.promisify(socket.close)();
}

async function send(event, data, { socket, port, instanceUuid, destinations }) {
  const obj = {
    event,
    procUuid: PUUID,
    instanceUuid,
    hostName: HOST_NAME,
    data
  };

  encode(obj, (err, contents) => {
    if (err) {
      return false;
    }

    const msg = new Buffer(contents);

    destinations.forEach((destination) => {
      socket.send(msg, 0, msg.length, port, destination);
    });
  });
}

function encode(key, data, callback) {
  let encoded;

  try {
    encoded = key ? encrypt(JSON.stringify(data), key) : JSON.stringify(data);
  } catch (e) {
    return callback(e);
  }

  return callback(undefined, encoded);
}

function decode(key, data, callback) {
  let decoded;

  try {
    if (key) {
      decoded = JSON.parse(decrypt(data.toString(), key));
    } else {
      decoded = JSON.parse(data);
    }
  } catch (e) {
    return callback(e);
  }

  return callback(undefined, decoded);
}

function encrypt(str, key) {
  const cipher = crypto.createCipher('aes256', key);
  const chunk1 = cipher.update(str, 'utf8', 'binary');
  const chunk2 = cipher.final('binary');

  return chunk1 + chunk2;
}

function decrypt(str, key) {
  const decipher = crypto.createDecipher('aes256', key);
  const chunk1 = decipher.update(str, 'binary', 'utf8');
  const chunk2 = decipher.final('utf8');

  return chunk1 + chunk2;
}
