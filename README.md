# Fantastic Waffle Container App EKS Hosting Stack

This Pulumi stack deploys a Kubernetes cluster on AWS EKS and a simple Nginx deployment to the cluster.

## Prerequisites:

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [AWS-IAM-AUTHENTICATOR](https://docs.aws.amazon.com/eks/latest/userguide/install-aws-iam-authenticator.html)
- [Pulumi CLI](https://www.pulumi.com/docs/install/)

### Pulumi Stack State

Because Pulumi needs access to the shared stack state stored in AWS S3, make sure you have configured AWS CLI with a valid AWS account that has access to the S3 Bucket:

```bash
aws configure --profile PROFILE_NAME
```

Set the following Environment Variables:

- `AWS_PROFILE` environment variable set to a valid AWS profile
- `AWS_DEFAULT_OUTPUT` environment variable set to `json`
- `AWS_REGION` environment variable set to a valid AWS region

# Usage:

## Install Pulumi stack dependancies

```bash
npm install
```

## Preview Pulumi stack deployment and review proposed creation or changes

```bash
pulumi preview
```

## Deploy the stack

```bash
pulumi up
```

The stack will deploy an EKS cluster with two worker nodes and a public load balancer. It will also deploy a simple Nginx deployment to the cluster.

Once the stack is deployed, you can access the Nginx deployment at the following URL:

```bash
pulumi stack output url
```

An example output is:

```bash
pulumi stack output url
a22cb128c586b4950b8445b406b77b90-372686433.us-east-1.elb.amazonaws.com
```

And an example output is:

```bash
curl http://a22cb128c586b4950b8445b406b77b90-372686433.us-east-1.elb.amazonaws.com/v1/
{"message":"Application is running"}
```

## Outputs:

### KubeConfig

`kubeconfig`: The Kubernetes configuration file for the EKS cluster. To output into a usable Kubeconfig file, run:

```bash
pulumi stack output kubeconfig > kubeconfig.yml
```

Then to use the `kubeconfig.yml` file with `kubectl`, run a command similar to this:

```bash
KUBECONFIG=kubeconfig.yml kubectl get services
```

with an expected output similar to:

```bash
KUBECONFIG=kubeconfig.yml kubectl get services
NAME         TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)   AGE
kubernetes   ClusterIP   172.20.0.1   <none>        443/TCP   25m
```

### URL

`url`: The URL of the LoadBalancer linked to the deployment.

## To destroy the stack:

```bash
pulumi destroy
```

This will delete the EKS cluster and all other resources created by the stack.
