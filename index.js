/* eslint-disable no-unused-vars */

const pulumi = require('@pulumi/pulumi')
const awsx = require('@pulumi/awsx')
const eks = require('@pulumi/eks')
const k8s = require('@pulumi/kubernetes')
const aws = require('@pulumi/aws')
const yaml = require('yaml')

const defaultTags = {
  // created: new Date().toISOString(),
  // updated: new Date().toISOString(),
  project: 'fantastic-waffle',
}
const currentDate = new Date().toISOString()

const pulumiConfig = new pulumi.Config()

const clusterName = pulumiConfig.get('clusterName') ? pulumiConfig.get('clusterName') : 'eks-i'
const clusterDesiredSize = pulumiConfig.get('clusterDesiredSize') ? parseInt(pulumiConfig.get('clusterDesiredSize'), 10) : 2
const clusterMinSize = pulumiConfig.get('clusterMinSize') ? parseInt(pulumiConfig.get('clusterMinSize'), 10) : 1
const clusterMaxSize = pulumiConfig.get('clusterMaxSize') ? parseInt(pulumiConfig.get('clusterMaxSize'), 10) : 2
const clusterVpcCIDR = pulumiConfig.get('clusterVpcCIDR') ? pulumiConfig.get('clusterVpcCIDR') : '10.0.0.0/16'
const deploymentName = pulumiConfig.get('deploymentName') ? pulumiConfig.get('deploymentName') : 'fantastic-telegram'
const deploymentImage = pulumiConfig.get('deploymentImage') ? pulumiConfig.get('deploymentImage') : 'nginx:latest'
const deploymentPort = pulumiConfig.get('deploymentPort') ? parseInt(pulumiConfig.get('deploymentPort'), 10) : 80
const deploymentReplicas = pulumiConfig.get('deploymentReplicas') ? parseInt(pulumiConfig.get('deploymentReplicas'), 10) : 1
const projectName = pulumi.getProject()

if (!process.env.AWS_PROFILE) {
  throw new Error('AWS_PROFILE must be set')
}

if (!process.env.AWS_REGION) {
  throw new Error('AWS_REGION must be set')
}
process.env.AWS_DEFAULT_OUTPUT = 'json'
const profileName = pulumi.output(process.env.ALT_AWS_PROFILE)
const region = pulumi.output(process.env.AWS_REGION)

const awsProvider = new aws.Provider('aws-provider', {
  profile: profileName,
  region,
  output: 'json',
  defaultTags: {
    tags: {
      project: 'fantastic-waffle',
    },
  },
})

const vpc = new awsx.ec2.Vpc(
  `${clusterName}-vpc`,
  {
    cidrBlock: clusterVpcCIDR,
    natGateways: {
      strategy: awsx.ec2.NatGatewayStrategy.None,
    },
    subnetSpecs: [
      {
        type: awsx.ec2.SubnetType.Public,
        cidrMask: 24,
      },
    ],
  },
  { provider: awsProvider }
)
// exports.vpc = vpc

const eksInstanceType = 't2.micro'

const kubeConfigOpts = { profileName, region }

const eksCluster = new eks.Cluster(
  `${clusterName}-cluster`,
  {
    vpcId: vpc.vpcId,
    desiredCapacity: clusterDesiredSize,
    instanceType: eksInstanceType,
    minSize: clusterMinSize,
    maxSize: clusterMaxSize,
    storageClasses: 'gp2',
    publicSubnetIds: vpc.publicSubnetIds,
    providerCredentialOpts: kubeConfigOpts,
    enabledClusterLogTypes: ['api', 'audit', 'authenticator', 'controllerManager', 'scheduler'],
  },
  {
    provider: awsProvider,
  }
)

exports.kubeconfig = eksCluster.kubeconfig.apply((kc) => {
  const kubeConfigYaml = new yaml.Document()
  kc.users[0].user.exec.args.push('--output', 'json')
  kubeConfigYaml.contents = kc
  const yamlOutput = kubeConfigYaml.toString()
  return yamlOutput
})
// exports.kubeconfig = eksCluster.kubeconfig // returns JSON???

const appNamespace = new k8s.core.v1.Namespace(`${clusterName}-namespace`, {}, { provider: eksCluster.provider })
const namespaceName = appNamespace.metadata.apply((m) => m.name)
// exports.namespaceName = namespaceName

const appLabels = { appClass: `${clusterName}-apps` }

// const deployment = new k8s.apps.v1.Deployment(
//   'nginx',
//   {
//     metadata: {
//       namespace: namespaceName,
//       labels: appLabels,
//     },
//     spec: {
//       replicas: 1,
//       selector: { matchLabels: appLabels },
//       template: {
//         metadata: {
//           labels: appLabels,
//         },
//         spec: {
//           containers: [
//             {
//               name: 'nginx-container',
//               image: 'nginx:latest',
//               ports: [
//                 {
//                   name: 'http',
//                   containerPort: 80,
//                 },
//               ],
//             },
//           ],
//         },
//       },
//     },
//   },
//   {
//     provider: eksCluster.provider,
//     dependsOn: [eksCluster],
//     customTimeouts: { create: '1m', update: '1m' },
//   }
// )
const appDeployment = new k8s.apps.v1.Deployment(
  deploymentName,
  {
    metadata: {
      namespace: namespaceName,
      labels: appLabels,
    },
    spec: {
      replicas: deploymentReplicas,
      selector: { matchLabels: appLabels },
      template: {
        metadata: {
          labels: appLabels,
        },
        spec: {
          containers: [
            {
              name: `${deploymentName}-container`,
              image: deploymentImage,
              ports: [
                {
                  name: 'http',
                  containerPort: deploymentPort,
                },
              ],
            },
          ],
        },
      },
    },
  },
  {
    provider: eksCluster.provider,
    dependsOn: [eksCluster],
    customTimeouts: { create: '1m', update: '1m' },
  }
)

// const deploymentName = deployment.metadata.apply((m) => m.name)
// exports.deploymentName = deploymentName

const loadBalancerService = new k8s.core.v1.Service(
  `${clusterName}-lb-service`,
  {
    metadata: {
      labels: appLabels,
      namespace: namespaceName,
    },
    spec: {
      type: 'LoadBalancer',
      ports: [{ port: 80, targetPort: 'http' }],
      selector: appLabels,
    },
  },
  {
    dependsOn: [appDeployment, eksCluster],
    provider: eksCluster.provider,
    customTimeouts: { create: '1m', update: '1m' },
  }
)

// // const loadBalancerServiceName = loadBalancerService.metadata.apply((m) => m.name)
// // exports.loadBalancerServiceName = loadBalancerServiceName
const loadBalancerServiceHostname = loadBalancerService.status.apply((s) => s.loadBalancer.ingress[0].hostname)
exports.loadBalancerServiceHostname = loadBalancerServiceHostname
