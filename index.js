import _ from 'lodash';
import getopt from 'node-getopt';
import IotProbe from './tplink/src/iot-probe/index.js';
import CacheManager from './cache/index.js';
import * as tplink from './tplink/src/index.js';
import * as govee from './govee/index.js';
import { 
  sleep,
  Logger,
  loadJson,
  getDirnameFromFile
} from './tplink/src/utils/index.js';
const rootConfig = await loadJson(getDirnameFromFile(import.meta.url) + '/config.json');

// Command line options configuration
const opt = getopt.create([
  ['n', 'nickname=NAME', 'Filter devices by nickname'],
  ['h', 'help', 'Display this help'],
  ['d', 'debug', 'Enable debug logging'],
  ['c', 'cache-clear', 'Clear the cache'],
  ['r', 'dry-run', 'Dry Run'],
]).bindHelp();

// Parse command line arguments
const { options } = opt.parseSystem();

const DEBUG_MODE = _.get(options, 'debug', false);
const DRYRUN = _.get(options, 'dry-run', false);
const nicknameFilter = _.get(options, 'nickname');
const logger = Logger(DEBUG_MODE);

// Configuration
const { email, password } = _.get(rootConfig, 'tapo', {});
const SCAN_CACHE = !_.get(options, 'cache-clear', false);
const DELAY_MS = 2000;

function isNumeric(x) {
  return !(isNaN(x)) && (typeof x !== "object") &&
    (x != Number.POSITIVE_INFINITY) && (x != Number.NEGATIVE_INFINITY);
}

const validateThermometerConfig = (config) => {
  if (!config.mac_addr) throw new Error("Missing Govee thermometer MAC address!");
  if (!config.plugs_managed?.length) throw new Error("No plugs configured!");

  config.plugs_managed.forEach(plug => {
    if (!plug.mac_addr) throw new Error(`Plug "${plug.name}" missing TPLink Plug MAC address!`);
    plug.conditions.forEach(condition => {
      const validComparators = ["gt", "gte", "lt", "lte"];
      if (!validComparators.includes(condition.when.comparator)) {
        throw new Error(`Invalid comparator "${condition.when.comparator}" in plug "${plug.name}"`);
      }
      if (isNaN(parseFloat(condition.when.value))) {
        throw new Error(`Temperature value must be a number in plug "${plug.name}"`);
      }
    });
  });
};

function isConditionMet(thermo, condition) {
  console.log(thermo, condition);
  const { key, comparator, value } = condition.when;
  if (!isNumeric(thermo[key])) {
    throw new Error(`property of ${key} is not a number: ${thermo[key]}`);
  } else if (!isNumeric(value)) {
    throw new Error(`condition criterion value is invalid: ${value}`);
  }
  switch (comparator) {
    case "gte":
      return (parseFloat(thermo[key]) >= parseFloat(value));
    case "gt":
      return (parseFloat(thermo[key]) > parseFloat(value));
    case "lte":
      return (parseFloat(thermo[key]) <= parseFloat(value));
    case "lt":
      return (parseFloat(thermo[key]) < parseFloat(value));
    default: 
      throw new Error(`condition comparator is invalid`);
  }
}

async function toggleDevicePower(device, deviceInfo) {
  try {
    const action = deviceInfo.device_on ? 'Off' : 'On';
    logger.info(`Turning ${action} device "${deviceInfo.nickname}"...`);
    if (DRYRUN) {
      logger.info(`DRYRUN, return early`);
      return;
    }
    await sleep(DELAY_MS);
    await device[`turn${action}`]();
    await sleep(DELAY_MS);
    const newState = await device.getDeviceInfo();
    logger.info(`Device "${deviceInfo.nickname}" turned ${action} successfully.`);
    logger.debug('New state:', newState);
    return newState;
  } catch (error) {
    logger.error(`Power toggle failed: ${_.get(error, 'message', error)}`);
    throw error;
  }
}

async function scanAndProcessDevices({deviceByMacAddrMap, staleCacheHandler}) {
  try {
   
    logger.info(`scanning for govee devices`);

    const goveeDeviceCache = new CacheManager({cacheFile: "./govee-device-result.json"}); 
    
    const goveeDevices = await goveeDeviceCache.accessFromCache(govee.getDevices({
      expectedCount: _.get(rootConfig, "govee.expected_device_count"),
      timeout: _.get(rootConfig, "govee.timeout", 60000),
    }), false);

    logger.info(goveeDevices['devices']);

    const plugMgmtConfig = _.get(rootConfig, "thermometers");

    for (const i in plugMgmtConfig) {
      const t = plugMgmtConfig[i];
      validateThermometerConfig(t);
      const found = _.find(_.get(goveeDevices, 'devices'), (d) => d.address === t.mac_addr);
      console.log({found})
      if (found) {
        if (_.get(t, 'plugs_managed.length') > 0) {
          logger.info(`Evaludating plugs for thermometer: ${t.name}`);
          for (const j in t.plugs_managed) {
            const pm = t.plugs_managed[j];
            if (!_.keys(deviceByMacAddrMap).includes(pm.mac_addr)) {
              throw new Error(`scanned plugs don't have a device with this mac address: ${pm.mac_addr}. Consider clearing cache!`);
            }
            const { device , info } = deviceByMacAddrMap[pm.mac_addr];
            logger.info(`Evaluating plug conditions for plug ${info.nickname} - Turned On (${info.device_on})`);
            const condTurnOff = _.find(pm.conditions, (pc) => pc.type == "turn_off");
            if (condTurnOff) {
              const shouldTurnOff = isConditionMet(found, condTurnOff);
              console.log({shouldTurnOff, device_on: info.device_on});
              if (info.device_on && shouldTurnOff) {
                logger.info(`Should turn off device ${info.nickname}`);
                await toggleDevicePower(device, info)
              } else if (!info.device_on && shouldTurnOff) {
                logger.info(`Device is already turned off, not turning off`);
              } else if (info.device_on && !shouldTurnOff) {
                logger.info(`Device did not meet turn off condition, leaving on`);
              } else if (!info.device_on && !shouldTurnOff) {
                logger.info(`Device is not turn on and shouldn't be turned off`);
              }
            }
            // check for turn-on conditions
            const condTurnOn = _.find(pm.conditions, (pc) => pc.type == "turn_on");
            if (condTurnOn) {
              const shouldTurnOn = isConditionMet(found, condTurnOn);
              console.log({shouldTurnOn, device_on: info.device_on});
              if (!info.device_on && shouldTurnOn) {
                logger.info(`Should turn on device ${info.nickname}`);
                await toggleDevicePower(device, info);
              } else if (info.device_on && shouldTurnOn) {
                logger.info(`Device is already on`);
              } else if (!info.device_on && !shouldTurnOn) {
                logger.info(`Device did not meet turn on condition, leaving off`);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    const errMsg = _.get(error, 'message', error);
    logger.error('Execution failed:', errMsg);
    if (errMsg.includes("Consider clearing cache") && _.isFunction(staleCacheHandler)) {
      await staleCacheHandler();
    }
    process.exit(1);
  }
}

logger.info('Starting Tapo device control script');
if (nicknameFilter) logger.info(`Nickname filter: "${nicknameFilter}"`);
const scannerConfig = _.get(rootConfig, 'plug_probe', {});
if (!SCAN_CACHE) {
  scannerConfig.clearCache = true;
}
const scanner = new IotProbe(scannerConfig);
const scannedDevices = await _.invoke(scanner, 'scan', SCAN_CACHE);
const deviceIPs = _.keys(scannedDevices);
logger.info(`Discovered ${deviceIPs.length} devices:`, deviceIPs);

const mapDeviceByMacFromIps = async (ips) => {
  const deviceByMacAddrMap = {};
  for (const ip in ips) {
    //here we have to make requests, so we should evaluate the condition first instead
    logger.info(`Connecting to device at ${ip}...`);
    const { device, info } = await tplink.getDeviceInfo({email, password}, ip);
    deviceByMacAddrMap[info.mac] = {device, info};
  }
  return deviceByMacAddrMap;
}

const tplinkDeviceCache = new CacheManager({cacheFile: "./tplink-device-result.json"});
const deviceByMacAddrMap = await tplinkDeviceCache.accessFromCache(mapDeviceByMacFromIps(scannedDevices), false);

const staleCacheHandler = async () => {
  logger.info(`stale cache handler attempting to clear the cache`);
  await scanner.clearCache();
}

await scanAndProcessDevices({deviceByMacAddrMap, staleCacheHandler});

if (!DRYRUN) {
  const interval = _.get(rootConfig, 'daemon_interval');
  if (interval) {
    logger.info(`Waiting ${interval} milliseconds before checking again`); 
    setInterval( async () => {
      // Execute the main workflow
      await scanAndProcessDevices({deviceByMacAddrMap, staleCacheHandler});
    }, interval)//every 5 minutes
  }
}

await sleep(1000);
process.exit(0);
