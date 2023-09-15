const k8s = require('@pulumi/kubernetes')

function KubeDeployment(name, { image, labels = {}, ...theArgs } = {}) {
  if (!(this instanceof KubeDeployment)) {
    return new KubeDeployment(name, { image, labels, ...theArgs })
  }

  const appLabels = { app: 'nginx' }
  const deployment = new k8s.apps.v1.Deployment('nginx', {
    spec: {
      selector: { matchLabels: 'fargate' },
      replicas: 1,
      template: {
        metadata: { labels: appLabels },
        spec: { containers: [{ name: 'nginx', image: 'nginx' }] },
      },
    },
  })

  this.name = deployment.metadata.name
}
module.exports = KubeDeployment
