// const pulumi = require('@pulumi/pulumi')
// const aws = require('@pulumi/aws')
const Vpc = require('./vpc')
const Eks = require('./eks')
const _kubeconfigBuilder = require('./kubeconfigBuilder')
// const KubeDeployment = require('./kubeDeployment')

const defaultTags = {
  created: new Date().toISOString(),
  // updated: new Date().toISOString(),
  project: 'fantastic-waffle',
}
// eslint-disable-next-line no-unused-vars
const vpcI = Vpc('VpcI', {
  cidrBlock: '172.20.0.0/16',
  subnets: [
    { az: 'a', dmz: true, cidrBlock: '172.20.1.0/24' },
    { az: 'b', dmz: true, cidrBlock: '172.20.2.0/24' },
    { az: 'c', dmz: true, cidrBlock: '172.20.3.0/24' },
    { az: 'd', dmz: false, cidrBlock: '172.20.4.0/24' },
    { az: 'e', dmz: false, cidrBlock: '172.20.5.0/24' },
    { az: 'f', dmz: false, cidrBlock: '172.20.6.0/24' },
  ],
  tags: defaultTags,
})

const eksI = Eks('EksI', {
  privateSubnets: vpcI.privateSubnets,
  publicSubnets: vpcI.publicSubnets,
  tags: defaultTags,
})

// console.log('KC', _kubeconfig, eksI.kubeAuth.id, eksI.kubeAuth.token)
// exports.vpc = vpcI.vpc
// exports.vpcSubnets = vpcI.privateSubnets
exports.Eks = eksI.kubeconfig
