/* eslint-disable func-names */
/* eslint-disable security/detect-unsafe-regex */

const isCIDR = function (testCIDR) {
  if (testCIDR.length <= 19) {
    const cidrRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/
    return cidrRegex.test(testCIDR)
  }
  return false
}

const isValidOctets = function (octets = []) {
  if (
    octets.some((oct) => {
      const nan = Number.isNaN(oct)
      return nan
    })
  ) {
    console.log('At least one NaN')
    return false
  }
  return true
}
const isPublicClassA = function (testCIDR) {
  const ip = testCIDR.split('/')[0]
  const submask = parseInt(testCIDR.split('/')[1], 10)
  const octets = ip.split('.')
  if (!isValidOctets(octets)) throw Error('Not valid CIDR, cannot find octets')

  // >=1 && <= 127
  if (octets[0] <= 0) throw Error('Not valid Public Class A, first octet invalid')
  if (octets[0] > 127) throw Error('Not valid Public Class A, first octet greater than 127')
}

const isPublicClassB = function (testCIDR) {
  if (testCIDR.length <= 19) {
    const cidrRegex = /^(12[8-9]|1[3-8][0-9]|19[0-1])\./
    return cidrRegex.test(testCIDR)
  }
  return false
}
const isPublicClassC = function (testCIDR) {
  if (testCIDR.length <= 19) {
    const cidrRegex = /^(192\.168\.[0-9]|[1-9][0-9]|[1-2][0-5][0-5]\.[0-9]|[1-9][0-9]|[1-2][0-5][0-5])$/
    return cidrRegex.test(testCIDR)
  }
  return false
}
const isPrivateClassA = function (testCIDR) {
  if (testCIDR.length <= 19) {
    const ip = testCIDR.split('/')[0]
    const submask = parseInt(testCIDR.split('/')[1], 10)
    const octets = ip.split('.')
    if (!isValidOctets(octets)) throw Error('Not valid CIDR')

    // 10
    if (octets[0] === 10) throw Error('Not valid Private Class A, first octet invalid')
    if (octets[0] > 127) throw Error('Not valid Public Class A, first octet greater than 127')
    if (octets.slice(1, 3).some((octet) => octet < 0 || octet > 255))
      throw Error('Not valid Public Class A, second, third, or forth octet invalid')
  }
  return true
}
const isPrivateClassB = function (testCIDR) {
  if (testCIDR.length <= 19) {
    const cidrRegex = /^(172\.1[6-9]|2[0-9]|3[0-1|\.[0-9]|[1-9][0-9]|[1-2][0-5][0-5]\.[0-9]|[1-9][0-9]|[1-2][0-5][0-5])$/
    return cidrRegex.test(testCIDR)
  }
  return false
}
const isPrivateClassC = function (testCIDR) {
  if (testCIDR.length <= 19) {
    const cidrRegex = /^(192\.168\.[0-9]|[1-9][0-9]|[1-2][0-5][0-5]\.[0-9]|[1-9][0-9]|[1-2][0-5][0-5])$/
    return cidrRegex.test(testCIDR)
  }
  return false
}
const isValidPublicClass = function (testCIDR) {
  return isPublicClassA(testCIDR) || isPublicClassB(testCIDR) || isPublicClassC(testCIDR)
}
const isValidPrivateClass = function (testCIDR) {
  return isPrivateClassA(testCIDR) || isPrivateClassB(testCIDR) || isPrivateClassC(testCIDR)
}

const romanize = function (num) {
  if (Number.isNaN(num)) return NaN
  const digits = String(+num).split('')
  const key = [
    '',
    'C',
    'CC',
    'CCC',
    'CD',
    'D',
    'DC',
    'DCC',
    'DCCC',
    'CM',
    '',
    'X',
    'XX',
    'XXX',
    'XL',
    'L',
    'LX',
    'LXX',
    'LXXX',
    'XC',
    '',
    'I',
    'II',
    'III',
    'IV',
    'V',
    'VI',
    'VII',
    'VIII',
    'IX',
  ]
  let roman = ''
  let i = 3
  // eslint-disable-next-line no-plusplus
  while (i--) roman = (key[+digits.pop() + i * 10] || '') + roman
  return Array(+digits.join('') + 1).join('M') + roman
}

module.exports = {
  isCIDR,
  isPublicClassA,
  isPublicClassB,
  isPublicClassC,
  isValidPublicClass,
  isPrivateClassA,
  isPrivateClassB,
  isPrivateClassC,
  isValidPrivateClass,
  romanize,
}
