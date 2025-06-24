#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EmailWranglerStack } from '../lib/email-wrangler-stack';

const app = new cdk.App();
const config = app.node.tryGetContext('config');

new EmailWranglerStack(app, 'EmailWranglerStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
  terminationProtection: false,
  config,
});