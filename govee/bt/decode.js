import { isHt5074, isHt5075, isHt5101, isHt5179 } from './validation.js'

export function decodeH5074Values(streamUpdate) {
  // inspired by https://github.com/Home-Is-Where-You-Hang-Your-Hack/sensor.goveetemp_bt_hci/blob/master/custom_components/govee_ble_hci/govee_advertisement.py#L116
  const temp_lsb = streamUpdate
    .substring(8, 10)
    .concat(streamUpdate.substring(6, 8))
  const hum_lsb = streamUpdate
    .substring(12, 14)
    .concat(streamUpdate.substring(10, 12))

  const tempInC = twos_complement(Number.parseInt(temp_lsb, 16)) / 100
  const tempInF = (tempInC * 9) / 5 + 32
  const humidity = Number.parseInt(hum_lsb, 16) / 100

  const battery = Number.parseInt(streamUpdate.substring(14, 16), 16)

  return {
    battery,
    humidity,
    tempInC,
    tempInF,
  }
}

export function decodeH5075Values(streamUpdate) {
  // TODO would be great to find a way to validate

  let encodedData = Number.parseInt(streamUpdate.substring(6, 12), 16)

  let tempIsNegative = false
  if (encodedData & 0x800000) {
    tempIsNegative = true
    encodedData = encodedData ^ 0x800000
  }

  const battery = Number.parseInt(streamUpdate.substring(12, 14), 16)
  let tempInC = encodedData / 10000
  if (tempIsNegative) {
    tempInC = 0 - tempInC
  }
  const tempInF = (tempInC * 9) / 5 + 32
  const humidity = (encodedData % 1000) / 10

  return {
    battery,
    humidity,
    tempInC,
    tempInF,
  }
}

export function decodeH5101Values(streamUpdate) {
  // TODO would be great to find a way to validate
  let encodedData = Number.parseInt(streamUpdate.substring(8, 14), 16)

  let tempIsNegative = false
  if (encodedData & 0x800000) {
    tempIsNegative = true
    encodedData = encodedData ^ 0x800000
  }

  const battery = Number.parseInt(streamUpdate.substring(14, 16), 16)
  let tempInC = encodedData / 10000
  if (tempIsNegative) {
    tempInC = 0 - tempInC
  }
  const tempInF = (tempInC * 9) / 5 + 32
  const humidity = (encodedData % 1000) / 10

  return {
    battery,
    humidity,
    tempInC,
    tempInF,
  }
}

export function decodeH5179Values(streamUpdate) {
  // TODO would be great to find a way to validate

  const temp_lsb = streamUpdate
    .substring(14, 16)
    .concat(streamUpdate.substring(16, 18))
  const hum_lsb = streamUpdate
    .substring(18, 20)
    .concat(streamUpdate.substring(16, 18))

  const tempInC = twos_complement(Number.parseInt(temp_lsb, 16)) / 100
  const tempInF = (tempInC * 9) / 5 + 32
  const humidity = Number.parseInt(hum_lsb, 16) / 100

  const battery = Number.parseInt(streamUpdate.substring(20, 22), 16)

  return {
    battery,
    humidity,
    tempInC,
    tempInF,
  }
}

export function decodeAny(streamUpdate) {
  if (isHt5074(streamUpdate)) {
    return decodeH5074Values(streamUpdate)
  }
  if (isHt5075(streamUpdate)) {
    return decodeH5075Values(streamUpdate)
  }
  if (isHt5101(streamUpdate)) {
    return decodeH5101Values(streamUpdate)
  }
  if (isHt5179(streamUpdate)) {
    return decodeH5179Values(streamUpdate)
  }

  throw new Error(`Unsupported stream update: ${streamUpdate}`)
}

function twos_complement(n, w = 16) {
  // Adapted from: https://stackoverflow.com/a/33716541.
  if (n & (1 << (w - 1))) {
    n = n - (1 << w)
  }
  return n
}
