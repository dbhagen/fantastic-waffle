/* eslint-disable no-unused-vars */

const pulumi = require('@pulumi/pulumi')
const awsx = require('@pulumi/awsx')
const eks = require('@pulumi/eks')
const k8s = require('@pulumi/kubernetes')
const aws = require('@pulumi/aws')
const yaml = require('yaml')

const pulumiConfig = new pulumi.Config()

/* These lines of code are retrieving values from the Pulumi configuration
file or using default values if the configuration values are not provided. */
const clusterName = pulumiConfig.get('clusterName') ? pulumiConfig.get('clusterName') : 'eks-i'
const clusterDesiredSize = pulumiConfig.get('clusterDesiredSize') ? parseInt(pulumiConfig.get('clusterDesiredSize'), 10) : 2
const clusterMinSize = pulumiConfig.get('clusterMinSize') ? parseInt(pulumiConfig.get('clusterMinSize'), 10) : 1
const clusterMaxSize = pulumiConfig.get('clusterMaxSize') ? parseInt(pulumiConfig.get('clusterMaxSize'), 10) : 2
const clusterVpcCIDR = pulumiConfig.get('clusterVpcCIDR') ? pulumiConfig.get('clusterVpcCIDR') : '10.0.0.0/16'
const deploymentName = pulumiConfig.get('deploymentName') ? pulumiConfig.get('deploymentName') : 'fantastic-telegram'
const deploymentImage = pulumiConfig.get('deploymentImage') ? pulumiConfig.get('deploymentImage') : 'nginx:latest'
const deploymentPort = pulumiConfig.get('deploymentPort') ? parseInt(pulumiConfig.get('deploymentPort'), 10) : 80
const deploymentReplicas = pulumiConfig.get('deploymentReplicas') ? parseInt(pulumiConfig.get('deploymentReplicas'), 10) : 1
const projectName = pulumiConfig.projectName ? pulumiConfig.projectName : 'fantastic-waffle'
/* Check if the environment variable `AWS_PROFILE` is set.If it is not set,
it throws an error with the message 'AWS_PROFILE must be set'. */
if (!process.env.AWS_PROFILE) {
  throw new Error('AWS_PROFILE must be set')
}

/* Check if the environment variable `AWS_DEFAULT_OUTPUT` is set.If it is not set,
it throws an error with the message 'AWS_DEFAULT_OUTPUT must be set'. */
if (!process.env.AWS_DEFAULT_OUTPUT) {
  throw new Error('AWS_DEFAULT_OUTPUT must be set')
}

/* Check if the environment variable `AWS_REGION` is set. If it is not set,
it throws an error with the message 'AWS_REGION must be set'. */
if (!process.env.AWS_REGION) {
  throw new Error('AWS_REGION must be set')
}

// HACK(Daniel Hagen): EKS provider fails if AWS profile set to 'text' and
// not 'json', trying to override for session.
/* The line `process.env.AWS_DEFAULT_OUTPUT = 'json'` sets the environment
variable `AWS_DEFAULT_OUTPUT` to the value `'json'`. */
process.env.AWS_DEFAULT_OUTPUT = 'json'

/* These lines of code are creating Pulumi outputs for the environment variables `AWS_PROFILE`,
`AWS_DEFAULT_OUTPUT`, and `AWS_REGION`. The `pulumi.output()` function is used to create an output
that represents the value of the environment variable. This allows the value to be used in other
parts of the code and ensures that any changes to the environment variable will trigger an update to
the Pulumi stack. */
const profileName = pulumi.output(process.env.AWS_PROFILE)
const profileOutput = pulumi.output(process.env.AWS_DEFAULT_OUTPUT)
const region = pulumi.output(process.env.AWS_REGION)

/* The code is creating an AWS provider object using the `aws.Provider` class from the `@pulumi/aws`
package. The provider object is responsible for authenticating and interacting with the AWS
services. */
const awsProvider = new aws.Provider('aws-provider', {
  profile: profileName,
  region,
  output: 'json',
  defaultTags: {
    tags: {
      project: projectName,
    },
  },
})

/* Create a new Amazon Virtual Private Cloud (VPC) using the `awsx.ec2.Vpc` class from
the `@pulumi/awsx` package to host the EKS cluster, making it easy to modify and remove. */
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

/* `eksInstanceType` is used later in the code when creating an EKS cluster to specify the instance
type for the worker nodes in the cluster. In this case, the instance type is set to `t2.micro`,
which is a type of EC2 instance that has a small amount of CPU and memory resources. */
const eksInstanceType = 't2.micro'

/* The line `const kubeConfigOpts = { profileName, region }` is creating an object called
`kubeConfigOpts` with two properties: `profileName` and `region`. These properties are assigned the
values of the variables `profileName` and `region`, respectively. This object is used later in the
code when creating an EKS cluster to specify the AWS profile and region to use for authentication
and interaction with the AWS services. */
const kubeConfigOpts = { profileName, region }

/* The code is creating an EKS (Elastic Kubernetes Service) cluster using the `eks.Cluster` class from
the `@pulumi/eks` package and parameters set before. Statically set is enabling logging and storage class
for the EC2 node instances. */
const eksCluster = new eks.Cluster(
  clusterName,
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

// HACK(Daniel Hagen): Fixing the Kubeconfig output to include an `--output` override for the AWS CLI so that it works
/* Modify the Kubernetes configuration (kubeconfig) generated by the `eksCluster.kubeconfig` property. */
exports.kubeconfig = eksCluster.kubeconfig.apply((kc) => {
  const kubeConfigYaml = new yaml.Document()
  kc.users[0].user.exec.args.push('--output', 'json')
  kubeConfigYaml.contents = kc
  const yamlOutput = kubeConfigYaml.toString()
  return yamlOutput
})
// exports.kubeconfig = eksCluster.kubeconfig // returns JSON???

/* Create a Kubernetes namespace in the EKS cluster. */
const appNamespace = new k8s.core.v1.Namespace(`${clusterName}-namespace`, {}, { provider: eksCluster.provider })
const namespaceName = appNamespace.metadata.apply((m) => m.name)

/* Create an object called `appLabels` with a single property `appClass`. The value of `appClass` is set to
a dynamic value combining the variable `clusterName` and `-apps`. This object is used later in the code to label
resources in the Kubernetes namespace. */
const appLabels = { appClass: `${clusterName}-apps` }

/* Create a Kubernetes Deployment object using the `k8s.apps.v1.Deployment` class from
the `@pulumi/kubernetes` package. */
const appDeployment = new k8s.apps.v1.Deployment(
  deploymentName,
  {
    /* The `metadata` property in the Kubernetes Deployment object is used to provide metadata about the
    deployment. */
    metadata: {
      namespace: namespaceName,
      labels: appLabels,
    },
    /* The `spec` property in the Kubernetes Deployment object is used to define the desired state of the
    deployment. */
    spec: {
      /* Set the number of replicas for the Kubernetes Deployment object. Replicas are multiple instances
      of a pod that are created and managed by Kubernetes. The `deploymentReplicas` variable is used to
      specify the desired number of replicas for the deployment. */
      replicas: deploymentReplicas,
      /* The `selector` property in the Kubernetes Deployment object is used to specify the labels that the
      Deployment will use to select which Pods to manage. In this case, the `selector` is set to `{
      matchLabels: appLabels }`, where `appLabels` is an object containing a single property `appClass`. */
      selector: { matchLabels: appLabels },
      template: {
        metadata: {
          labels: appLabels,
        },
        spec: {
          containers: [
            {
              /* Set the name of the container within the Kubernetes Deployment object. The name is set to
              the value of the `deploymentName` variable concatenated with the string "-container".
              This is used to uniquely identify the container within the deployment. */
              name: `${deploymentName}-container`,
              /* Specify the Docker image to use for the container within the Kubernetes Deployment object.
              The value of `deploymentImage` is a string that represents the image name and tag, such as
              `nginx:latest`. This tells Kubernetes to pull the specified image from a container registry
              and use it to create the container within the deployment. */
              image: deploymentImage,
              /* The `imagePullPolicy: 'Always'` setting in the Kubernetes Deployment object specifies the
              policy for pulling the container image, requiring the image to be pulled during every update. */
              imagePullPolicy: 'Always',
              /* Specify the ports that should be exposed by the container within the Kubernetes Deployment
              object. In this case, it is an array of objects, where each object represents a port
              configuration. */
              ports: [
                {
                  /* Specifying the name of the port that should be exposed by the container within the
                  Kubernetes Deployment object. In this case, the name is set to 'http', which is a common
                  name used for the HTTP protocol. This allows other services or resources within the Kubernetes
                  cluster to reference this port by its name when communicating with the container. */
                  name: 'http',
                  /* Specifying the port number that should be exposed by the container within the Kubernetes
                  Deployment object. The value of `deploymentPort` is a number that represents the port number
                  that the container will listen on for incoming traffic. This allows other services or
                  resources within the Kubernetes cluster to communicate with the container using this port. */
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
    /* The `customTimeouts` property is used to specify the timeout duration for resource creation and
    update operations in Pulumi. In this case, it is set to `'1m'`, which means that Pulumi will wait
    for a maximum of 1 minute for the resource creation or update operation to complete. If the
    operation takes longer than 1 minute, Pulumi will consider it as a timeout and fail the operation.
    This property is useful for controlling the maximum time Pulumi spends waiting for resource
    operations to complete. */
    customTimeouts: { create: '1m', update: '1m' },
  }
)

/* Create a Kubernetes Service object using the `k8s.core.v1.Service` class from the
`@pulumi/kubernetes` package to host our load balancing service. */
const loadBalancerService = new k8s.core.v1.Service(
  `${clusterName}-lb-service`,
  {
    metadata: {
      labels: appLabels,
      namespace: namespaceName,
    },
    spec: {
      /* The `type: 'LoadBalancer'` property in the Kubernetes Service object specifies
      the type of service to create. In this case, it is creating a LoadBalancer service. */
      type: 'LoadBalancer',
      /* Define a list of ports for the LoadBalancer to listen on. Each port object in
      the list specifies a port number and a target port. In this case, the port number is 80 and
      the target port is 'http'. */
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

const loadBalancerServiceHostname = loadBalancerService.status.apply((s) => s.loadBalancer.ingress[0].hostname)
exports.loadBalancerServiceHostname = loadBalancerServiceHostname
exports.url = loadBalancerServiceHostname
