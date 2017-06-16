// import dgram from 'dgram';
// import crypto from 'crypto';
// import os from 'os';
// import util from 'util';
// import uuid from '@libs/uuid';
// import Emitter from '@libs/emitter';

// const nodeVersion = process.version.slice(1).split('.');
// const procUuid = uuid.v4();
// const hostName = os.hostname();

// const defaultOpts = {
//   address
// }


// export default function Network({
//   address = '0.0.0.0',
//   port = 11777,
//   broadcast,
//   multicast,
//   multicastTTL = 1,
//   unicast,
//   key,
//   reuseAddr = true,
//   ignoreProcess = true,
//   ignoreInstance = true
// } = {}) {
//   const emitter = Emitter();
//   const socket = dgram.createSocket({ type: 'udp4', reuseAddr });
//   const instanceUuid = uuid.v4();

//   socket.on('message', (data, rinfo) => {
//     decode(key, data, (err, decoded) => {
//       const { pid, iid, event, data } = decoded;

//       if (err) {
//         // most decode errors are because we tried
//         // to decrypt a packet for which we do not
//         // have the key

//         // the only other possibility is that the
//         // message was split across packet boundaries
//         // and that is not handled

//         // self.emit("error", err);
//       } else if (pid === procUuid && ignoreProcess && iid !== instanceUuid) {
//         return false;
//       } else if (iid === instanceUuid && ignoreInstance) {
//         return false;
//       } else if (event && data) {
//         emitter.emit(event, data, decoded, rinfo);
//       } else {
//         emitter.emit('message', decoded);
//       }
//     });
//   });
// }


//     self.socket.on("message", function ( data, rinfo ) {
//         self.decode(data, function (err, obj) {
//             if (err) {
//                 //most decode errors are because we tried
//                 //to decrypt a packet for which we do not
//                 //have the key

//                 //the only other possibility is that the
//                 //message was split across packet boundaries
//                 //and that is not handled

//                 //self.emit("error", err);
//             }
//           else if (obj.pid == procUuid && self.ignoreProcess && obj.iid !== self.instanceUuid) {
//                     return false;
//             }
//             else if (obj.iid == self.instanceUuid && self.ignoreInstance) {
//                     return false;
//             }
//             else if (obj.event && obj.data) {
//                 self.emit(obj.event, obj.data, obj, rinfo);
//             }
//             else {
//                 self.emit("message", obj)
//             }
//         });
//     });

// //     self.on("error", function (err) {
// //         //TODO: Deal with this
// //         /*console.log("Network error: ", err.stack);*/
// //     });
// // };

// // util.inherits(Network, EventEmitter);

// // Network.prototype.start = function (callback) {
// //     var self = this;

// //     self.socket.bind(self.port, self.address, function () {
// //         if (self.unicast) {
// //             if (typeof self.unicast === 'string' && ~self.unicast.indexOf(',')) {
// //                 self.unicast = self.unicast.split(',');
// //             }

// //             self.destination = [].concat(self.unicast);
// //         }
// //         else if (!self.multicast) {
// //             //Default to using broadcast if multicast address is not specified.
// //             self.socket.setBroadcast(true);

// // TODO: get the default broadcast address from os.networkInterfaces() (not currently returned)
// //             self.destination = [self.broadcast || "255.255.255.255"];
// //         }
// //         else {
// //             try {
// //                 //addMembership can throw if there are no interfaces available
// //                 self.socket.addMembership(self.multicast);
// //                 self.socket.setMulticastTTL(self.multicastTTL);
// //             }
// //             catch (e) {
// //                 self.emit('error', e);

// //                 return callback && callback(e);
// //             }

// //             self.destination = [self.multicast];
// //         }

// //         return callback && callback();
// //     });
// // };

// // Network.prototype.stop = function (callback) {
// //     var self = this;

// //     self.socket.close();

// //     return callback && callback();
// // };

// // Network.prototype.send = function (event) {
// //     var self = this;

// //     var obj = {
// //         event : event,
// //         pid : procUuid,
// //         iid : self.instanceUuid,
// //         hostName : hostName
// //     };

// //     if (arguments.length == 2) {
// //         obj.data = arguments[1];
// //     }
// //     else {
// //         //TODO: splice the arguments array and remove the first element
// //         //setting data to the result array
// //     }

// //     self.encode(obj, function (err, contents) {
// //         if (err) {
// //             return false;
// //         }

// //         var msg = new Buffer(contents);

// //         self.destination.forEach(function (destination) {
// //             self.socket.send(
// //                 msg
// //                 , 0
// //                 , msg.length
// //                 , self.port
// //                 , destination
// //             );
// //         });
// //     });
// // };

// function encode(key, data, callback) {
//   let encoded;

//   try {
//     encoded = key ? encrypt(JSON.stringify(data), key) : JSON.stringify(data);
//   } catch (e) {
//     return callback(e);
//   }

//   return callback(undefined, encoded);
// }

// function decode (key, data, callback) {
//   let decoded;

//   try {
//     if (key) {
//       decoded = JSON.parse(decrypt(data.toString(), key));
//     } else {
//       decoded = JSON.parse(data);
//     }
//   } catch (e) {
//     return callback(e);
//   }

//   return callback(undefined, decoded);
// }

// function encrypt(str, key) {
//   const cipher = crypto.createCipher('aes256', key);
//   const chunk1 = cipher.update(str, 'utf8', 'binary');
//   const chunk2 = cipher.final('binary');

//   return chunk1 + chunk2;
// }

// function decrypt(str, key) {
//   const decipher = crypto.createDecipher('aes256', key);
//   const chunk1 = decipher.update(str, 'binary', 'utf8');
//   const chunk2 = decipher.final('utf8');

//   return chunk1 + chunk2;
// }
"use strict";