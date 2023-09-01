const aws = require('@pulumi/aws')

function Eks(name, { subnets = [], tags = {}, ...theArgs } = {}) {
  if (!(this instanceof Eks)) {
    return new Eks(name, { subnets, tags, ...theArgs })
  }

  this.eksAssumeRole = aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        effect: 'Allow',
        principals: [
          {
            type: 'Service',
            identifiers: ['eks.amazonaws.com'],
          },
        ],
        actions: ['sts:AssumeRole'],
      },
    ],
  })

  this.eksRole = new aws.iam.Role(`${name}-role`, { assumeRolePolicy: this.eksAssumeRole.json })

  this.eksClusterPolicy = new aws.iam.RolePolicyAttachment(`${name}-AmazonEKSClusterPolicy`, {
    policyArn: 'arn:aws:iam::aws:policy/AmazonEKSClusterPolicy',
    role: this.eksRole.name,
  })

  this.eks = new aws.eks.Cluster(
    name,
    {
      roleArn: this.eksRole.arn,
      vpcConfig: subnets.map((subnet) => subnet.id),
      tags: { Name: name, ...tags },
      ...theArgs,
    },
    {
      ignoreChanges: ['tags.created', 'tagsAll.created'],
    }
  )
}

module.exports = Eks
