"use strict";
const pulumi = require("@pulumi/pulumi")
const { local } = require('@pulumi/command')
const aws = require("@pulumi/aws")

const pulumiS3BackendKMSEncryptionKey = new aws.kms.Key("pulumiS3BackendKMSEncryptionKey", {
  description: "This key is used to encrypt bucket objects",
  deletionWindowInDays: 30,
  enableKeyRotation: true,
  isEnabled: true,
  tags: {
    Environment: "Prod",
    Name: "pulumiS3BackendBucket"
  },
});

const pulumiKMSEncryptionKey = new aws.kms.Key("pulumiKMSEncryptionKey", {
  description: "This key is used to encrypt Pulumi Secrets",
  deletionWindowInDays: 30,
  enableKeyRotation: true,
  isEnabled: true,
  tags: {
    Environment: "Prod",
    Name: "pulumiKMSEncryptionKey"
  },
});

// Create an AWS resource (S3 Bucket)
const pulumiS3Backend = new aws.s3.Bucket("pulumiS3Backend", {
  acl: 'private',
  tags: {
    Environment: "Prod",
    Name: "pulumiS3BackendBucket"
  },
  versioning: {
    enabled: true,
  },
  serverSideEncryptionConfiguration: {
    rule: {
      applyServerSideEncryptionByDefault: {
        kmsMasterKeyId: pulumiS3BackendKMSEncryptionKey.arn,
        sseAlgorithm: "aws:kms",
      },
    },
  }
});

// Export the name of the bucket
exports.pulumiS3BackendName = pulumiS3Backend.id;
exports.pulumiKMSEncryptionKeyId = pulumiKMSEncryptionKey.id
