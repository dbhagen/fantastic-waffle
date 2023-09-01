// const pulumi = require('@pulumi/pulumi')
// const aws = require('@pulumi/aws')
const Vpc = require('./vpc')
const Eks = require('./eks')

const defaultTags = {
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
  project: 'fantastic-waffle',
}
// eslint-disable-next-line no-unused-vars
const vpcI = Vpc('VpcI', {
  cidrBlock: '172.20.0.0/16',
  subnets: [
    { az: 'a', dmz: true, cidrBlock: '172.20.1.0/24' },
    { az: 'b', dmz: true, cidrBlock: '172.20.2.0/24' },
  ],
  tags: defaultTags,
})

const _eksI = Eks('EksI', {
  subnets: vpcI.subnets,
  tags: defaultTags,
})

// exports.vpc = vpcI.vpc
// exports.vpcSubnets = vpcI.subnets
