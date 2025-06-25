import {startDiscovery} from './bt/index.js';

import _ from 'lodash';

export const getDevices = ({expectedCount = 0, timeout = 20000}) => {
  return new Promise((resolve, reject) => {
    if (expectedCount <= 0) {
      return reject(new Error("expectedCount must be greater than 1"));
    }
    let found = 0;
    const devices = [];
    const deviceMacs = [];
    setTimeout(() => {
      if (found < expectedCount) { 
        reject(new Error("Finding devices timed out"));
      }
    }, timeout);
    startDiscovery((device) => {
      if (found >= expectedCount) {
        return;
      }
      else if (!_.includes(deviceMacs, device.address)) {
        deviceMacs.push(device.address);
        devices.push(device);
        found++;
        if (found == expectedCount) {
          resolve({devices});
        } 
      }
    });
  });
}
