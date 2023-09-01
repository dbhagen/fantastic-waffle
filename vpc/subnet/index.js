const aws = require('@pulumi/aws')

function Subnet(name, { tags = {}, ...theArgs } = {}) {
  if (!(this instanceof Subnet)) {
    return new Subnet(name, { tags, ...theArgs })
  }

  return new aws.ec2.Subnet(
    name,
    {
      tags: { Name: name, ...tags },
      ...theArgs,
    },
    {
      ignoreChanges: ['tags.created', 'tagsAll.created'],
    }
  )
}

module.exports = Subnet
