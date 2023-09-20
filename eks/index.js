const aws = require('@pulumi/aws')
// const awsEks = require('@pulumi/eks')
const _kubeconfigBuilder = require('../kubeconfigBuilder')

function Eks(
  name,
  { privateSubnets = [], publicSubnets = [], tags = {}, ...theArgs } = {}
) {
  if (!(this instanceof Eks)) {
    return new Eks(name, { privateSubnets, publicSubnets, tags, ...theArgs })
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

  this.eksRole = new aws.iam.Role(`${name}-role`, {
    assumeRolePolicy: this.eksAssumeRole.json,
  })

  this.eksClusterPolicy = new aws.iam.RolePolicyAttachment(
    `${name}-AmazonEKSClusterPolicy`,
    {
      policyArn: 'arn:aws:iam::aws:policy/AmazonEKSClusterPolicy',
      role: this.eksRole.name,
      tags: { Name: name, ...tags },
      ...theArgs,
    },
    {
      ignoreChanges: ['tags.created', 'tagsAll.created'],
    }
  )

  this.controlPlaneLogging = new aws.cloudwatch.LogGroup(
    `${name}LogGroup`,
    {
      retentionInDays: 7,
      name: `${name}LogGroup`,
      tags: { Name: `${name}LogGroup`, ...tags },
      ...theArgs,
    },
    {
      ignoreChanges: ['tags.created', 'tagsAll.created'],
    }
  )

  this.eks = new aws.eks.Cluster(
    name,
    {
      name: `${name}Cluster`,
      roleArn: this.eksRole.arn,
      vpcConfig: {
        subnetIds: publicSubnets.map((subnet) => subnet.id),
      },
      enabledClusterLogTypes: ['api', 'audit'],
      tags: { Name: name, ...tags },
      ...theArgs,
    },
    {
      dependsOn: [this.controlPlaneLogging, this.eksClusterPolicy],
      ignoreChanges: ['tags.created', 'tagsAll.created', 'vpcConfig'],
    }
  )
  this.kubeAuth = aws.eks.getClusterAuthOutput({
    name: `${name}Cluster`,
  })

  // this.kubeconfig = kubeconfigBuilder('EksI', {
  //   clusterAccessPoint: this.eks.endpoint,
  //   certificateAuthorityData: this.eks.certificateAuthority.data,
  //   userName: this.kubeAuth.id,
  //   userAuthToken: this.kubeAuth.token,
  // }).kubeconfig

  this.kubeconfig = this.eks.getProviderOutput()

  // const { accountId } = aws.getCallerIdentityOutput({})
  // const awsRegion = aws.getRegionOutput({})

  this.eksFargateRole = new aws.iam.Role(
    `${name}-fargate-role`,
    {
      assumeRolePolicy: JSON.stringify({
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'eks-fargate-pods.amazonaws.com',
            },
          },
        ],
        Version: '2012-10-17',
      }),
      tags: { Name: name, ...tags },
    },
    {
      ignoreChanges: ['tags.created', 'tagsAll.created'],
    }
  )

  this.eksFargatePodExecutionRolePolicy = new aws.iam.RolePolicyAttachment(
    `${name}-eksFargatePodExecutionRolePolicy`,
    {
      policyArn:
        'arn:aws:iam::aws:policy/AmazonEKSFargatePodExecutionRolePolicy',
      role: this.eksFargateRole,
      tags: { Name: name, ...tags },
    },
    {
      ignoreChanges: ['tags.created', 'tagsAll.created'],
    }
  )

  this.eksFargateProfile = new aws.eks.FargateProfile(
    `${name}-fargate-profile`,
    {
      clusterName: this.eks.name,
      podExecutionRoleArn: this.eksFargateRole.arn,
      subnetIds: privateSubnets.map((subnet) => subnet.id),
      selectors: [
        {
          namespace: 'fargate',
        },
      ],
      tags: { Name: name, ...tags },
    },
    {
      dependsOn: [this.controlPlaneLogging, this.eksClusterPolicy],
      ignoreChanges: ['tags.created', 'tagsAll.created'],
    }
  )
}

module.exports = Eks
