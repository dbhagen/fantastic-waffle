const YAML = require('yaml')

function KubeConfigBuilder(
  clusterName = '<cluster-name>',
  {
    clusterAccessPoint = 'https://127.0.0.1',
    certificateAuthorityData = '<ca-data-here>',
    userName = '<cluster-name-user>',
    userAuthToken = '<secret-token-here>',
    ...theArgs
  } = {}
) {
  if (!(this instanceof KubeConfigBuilder)) {
    return new KubeConfigBuilder(clusterName, {
      clusterAccessPoint,
      certificateAuthorityData,
      userName,
      userAuthToken,
      ...theArgs,
    })
  }

  const doc = new YAML.Document()
  doc.contents = {
    apiVersion: 'v1',
    clusters: [
      {
        cluster: {
          'certificate-authority-data': certificateAuthorityData,
        },
        name: clusterName,
      },
    ],
    contexts: [
      {
        context: {
          cluster: clusterName,
          user: userName,
        },
        name: clusterName,
      },
    ],
    'current-context': clusterName,
    kind: 'Config',
    preferences: {},
    users: [
      {
        name: userName,
        user: {
          token: userAuthToken,
        },
      },
    ],
  }

  this.kubeconfig = doc.toString()
}

module.exports = KubeConfigBuilder
