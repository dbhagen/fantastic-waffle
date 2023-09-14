const aws = require('@pulumi/aws')

function Subnet(name, { dmz = false, tags = {}, ...theArgs } = {}) {
  if (!(this instanceof Subnet)) {
    return new Subnet(name, { dmz, tags, ...theArgs })
  }

  return new aws.ec2.Subnet(
    name,
    {
      tags: {
        Name: name,
        DMZ: dmz ? 'true' : 'false',
        ...tags,
      },
      ...theArgs,
    },
    {
      ignoreChanges: ['tags.created', 'tagsAll.created'],
    }
  )
}

module.exports = Subnet
