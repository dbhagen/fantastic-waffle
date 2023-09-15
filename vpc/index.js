const awsx = require('@pulumi/awsx')
const Subnet = require('./subnet')
const ipTools = require('../utils/ipTools')

function Vpc(
  name = 'main',
  {
    cidrBlock = '10.0.0.0/16',
    subnets = [
      { dmz: false, cidrBlock: '10.0.1.0/24' },
      { dmz: false, cidrBlock: '10.0.2.0/24' },
      { dmz: true, cidrBlock: '10.0.3.0/24' },
      { dmz: true, cidrBlock: '10.0.4.0/24' },
    ],
    tags = {},
    ...theArgs
  } = {}
) {
  if (!(this instanceof Vpc)) {
    return new Vpc(name, { cidrBlock, subnets, tags, ...theArgs })
  }

  this.vpc = new awsx.ec2.Vpc(
    name,
    {
      cidrBlock,
      enableDnsSupport: true,
      instanceTenancy: 'default',
      tags: { Name: name, ...tags },
      ...theArgs,
    },
    {
      ignoreChanges: ['tags.created', 'tagsAll.created'],
    }
  )

  this.igw = new awsx.ec2.InternetGateway(
    `${name}-igw`,
    {
      tags: { Name: `${name}-igw`, ...tags },
    },
    {
      ignoreChanges: ['tags.created', 'tagsAll.created'],
    }
  )

  this.publicRouteTable = new awsx.ec2.RouteTable(
    `${name}-PublicRouteTable`,
    {
      vpcId: this.vpc.id,
      routes: [
        {
          cidrBlock: '0.0.0.0/0',
          gatewayId: this.igw.id,
        },
      ],
      tags: {
        Name: `${name}-PublicRouteTable`,
        ...tags,
      },
    },
    {
      ignoreChanges: ['tags.created', 'tagsAll.created'],
    }
  )
  this.privateRouteTable = new awsx.ec2.RouteTable(
    `${name}-PrivateRouteTable`,
    {
      vpcId: this.vpc.id,
      tags: {
        Name: `${name}-PrivateRouteTable`,
        ...tags,
      },
    },
    {
      ignoreChanges: ['tags.created', 'tagsAll.created'],
    }
  )

  const availableRegionAZs = awsx.getAvailabilityZones({
    state: 'available',
  })

  let subnetCounter = 0
  this.privateSubnets = subnets.map((subnet, index) => {
    if (!subnet.dmz) {
      subnetCounter += 1
      const tmpSubnet = Subnet(`Subnet${ipTools.romanize(subnetCounter)}-${subnet.dmz ? 'dmz' : 'private'}`, {
        vpcId: this.vpc.id,
        // eslint-disable-next-line security/detect-object-injection
        availabilityZone: availableRegionAZs.then((az) => az.names[index]),
        cidrBlock: subnet.cidrBlock,
        dmz: subnet.dmz,
        tags,
      })
      const _routeTableAssociation = new awsx.ec2.RouteTableAssociation(
        `Subnet${ipTools.romanize(index + 1)}-PrivateRouteTableAssociation`,
        {
          subnetId: tmpSubnet.id,
          routeTableId: this.privateRouteTable.id,
        }
      )
      return tmpSubnet
    }
    return false
  })
  this.publicSubnets = subnets.map((subnet, index) => {
    subnetCounter += 1
    if (subnet.dmz) {
      const tmpSubnet = Subnet(`Subnet${ipTools.romanize(subnetCounter)}-${subnet.dmz ? 'dmz' : 'private'}`, {
        vpcId: this.vpc.id,
        // eslint-disable-next-line security/detect-object-injection
        availabilityZone: availableRegionAZs.then((az) => az.names[index]),
        cidrBlock: subnet.cidrBlock,
        dmz: subnet.dmz,
        tags,
      })
      const _routeTableAssociation = new awsx.ec2.RouteTableAssociation(
        `Subnet${ipTools.romanize(index + 1)}-PublicRouteTableAssociation`,
        {
          subnetId: tmpSubnet.id,
          routeTableId: this.publicRouteTable.id,
        }
      )
      return tmpSubnet
    }
    return false
  })
}

module.exports = Vpc
