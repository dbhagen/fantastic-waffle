const aws = require('@pulumi/aws')
const Subnet = require('./subnet')
const ipTools = require('../utils/ipTools')

function Vpc(
  name = 'main',
  {
    cidrBlock = '10.0.0.0/16',
    subnets = [
      { cidrBlock: '10.0.1.0/24' },
      { cidrBlock: '10.0.2.0/24' },
    ],
    tags = {},
    ...theArgs
  } = {}
) {
  if (!(this instanceof Vpc)) {
    return new Vpc(name, { cidrBlock, subnets, tags, ...theArgs }
    )
  }

  this.vpc = new aws.ec2.Vpc(name, {
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

  const availableRegionAZs = aws.getAvailabilityZones({
    state: 'available',
  })
  this.subnets = subnets.map((subnet, index) => {
    return Subnet(`Subnet${ipTools.romanize(index + 1)}`, {
      vpcId: this.vpc.id,
      // eslint-disable-next-line security/detect-object-injection
      availabilityZone: availableRegionAZs.then((az) => az.names?.[index]),
      cidrBlock: subnet.cidrBlock,
      tags: tags,
    })
  })

  this.igw = new aws.ec2.InternetGateway(`${name}-igw`, {
    vpcId: this.vpc.id,
    tags: { Name: `${name}-igw`, ...tags }
  },
    {
      ignoreChanges: ['tags.created', 'tagsAll.created'],
    }
  )

  this.routeTable = new aws.ec2.RouteTable(`${name}-MainRouteTable`, {
    vpcId: this.vpc.id,
    routes: [
      {
        cidrBlock: '0.0.0.0/0',
        gatewayId: this.igw.id
      }
    ],
    tags: {
      Name: `${name}-MainRouteTable`,
      ...tags
    }
  })
  new aws.ec2.MainRouteTableAssociation(`${name}-MainRouteTableAssociation`, {
    vpcId: this.vpc.id,
    routeTableId: this.routeTable.id
  })

}

module.exports = Vpc
