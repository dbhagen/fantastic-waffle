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
const clusterDesiredSize = pulumiConfig.get('clusterDesiredSize') ? pulumiConfig.get('clusterDesiredSize') : 2
const clusterMinSize = pulumiConfig.get('clusterMinSize') ? pulumiConfig.get('clusterMinSize') : 1
const clusterMaxSize = pulumiConfig.get('clusterMaxSize') ? pulumiConfig.get('clusterMaxSize') : 2
const vpcCIDR = pulumiConfig.get('vpcCIDR') ? pulumiConfig.get('vpcCIDR') : '10.0.0.0/16'
const deploymentImage = pulumiConfig.get('deploymentImage') ? pulumiConfig.get('deploymentImage') : 'nginx:latest'
const deploymentReplicas = pulumiConfig.get('deploymentReplicas') ? pulumiConfig.get('deploymentReplicas') : 1
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

const vpc = new awsx.ec2.Vpc(`${clusterName}-vpc`, {}, { provider: awsProvider })
exports.vpc = vpc

const eksInstanceType = 't2.micro'

const kubeConfigOpts = { profileName, region }

const eksCluster = new eks.Cluster(
  `${clusterName}-cluster`,
  {
    fargate: true,
    vpcId: vpc.vpcId,
    privateSubnetIds: vpc.privateSubnetIds,
    skipDefaultNodeGroup: true,
    providerCredentialOpts: kubeConfigOpts,
    enabledClusterLogTypes: ['api', 'audit', 'authenticator', 'controllerManager', 'scheduler'],
    vpcCniOptions: {
      disableTcpEarlyDemux: true,
    },
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

const appNamespace = new k8s.core.v1.Namespace(`${clusterName}-k8s-app-namespace`, {}, { provider: eksCluster.provider })
const namespaceName = appNamespace.metadata.apply((m) => m.name)
exports.namespaceName = namespaceName

const appLabels = { appClass: `${clusterName}-app-class` }
const deployment = new k8s.apps.v1.Deployment(
  `${clusterName}-k8s-deployment`,
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
              name: `${clusterName}-k8s-nginx`,
              image: deploymentImage,
              ports: [
                {
                  name: 'http',
                  containerPort: 80,
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
  }
)

const deploymentName = deployment.metadata.apply((m) => m.name)
exports.deploymentName = deploymentName

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
    provider: eksCluster.provider,
  }
)

const loadBalancerServiceName = loadBalancerService.metadata.apply((m) => m.name)
const loadBalancerServiceHostname = loadBalancerService.status.apply((s) => s.loadBalancer.ingress[0].hostname)

exports.loadBalancerServiceName = loadBalancerServiceName
exports.loadBalancerServiceHostname = loadBalancerServiceHostname
