import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as actions from 'aws-cdk-lib/aws-ses-actions';
import * as r53 from 'aws-cdk-lib/aws-route53';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as destinations from 'aws-cdk-lib/aws-lambda-destinations';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'

export interface ContextProps extends cdk.StackProps {
  config: {
    domain: string;     
    mailbox: string;
  }
}

export class EmailWranglerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ContextProps) {
    super(scope, id, props);

    // Lookup the Route 53 Hosted Zone for the domain
    const hostedZone = r53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.config.domain,
    });

    // Create MX record in Hosted Zone for SES inbound servers
    new r53.MxRecord(this, 'InboundSmtpRecord', {
      zone: hostedZone,
      recordName: props.config.domain,
      comment: 'SES email receiving',
      values: [{
        priority: 10,
        hostName: `inbound-smtp.${this.region}.amazonaws.com`
      }]
    });

    // Create TXT record in Hosted Zone for Sender Policy Framework
    new r53.TxtRecord(this, 'SenderPolicyRecord', {
      zone: hostedZone,
      recordName: props.config.domain,
      comment: 'Disable sending mail from this domain',
      values: [ 'v=spf1 -all' ]                 
    })

    // Create an EventBridge event bus for events
    const eventBus = new events.EventBus(this, 'EventBus');

    // Create an S3 bucket to store incoming emails
    const mailBucket= new s3.Bucket(this, 'SesBucket', {
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
      encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [{
        id: 'DeleteOldEmails',
        enabled: true,
        expiration: cdk.Duration.days(30),
      }],
    });

    // Create Lamba function for processing incoming emails
    const sesFn = new NodejsFunction(this, 'SesExtractor', {
      entry: 'src/lambda/ses-extractor.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      bundling: {
        minify: false,
        nodeModules: [ 'mailparser' ]
      },
      environment: {
        BUCKET_EMAILS: mailBucket.bucketName,
        FOLDER_INCOMING: 'incoming',
        FOLDER_ATTACHMENTS: 'attachments',
      },
      onSuccess: new destinations.EventBridgeDestination(eventBus),
      onFailure: new destinations.EventBridgeDestination(eventBus)
    });

    // Grant the Lambda function read/write access to the S3 bucket
    mailBucket.grantReadWrite(sesFn);

    // Create an EventBridge rule to capture Lambda destination events
    new events.Rule(this, 'SesExtractorDest', {
      description: 'Capture SesExtractor function invocation results',
      eventBus: eventBus,
      eventPattern: {
        source: [ 'lambda' ],
        detailType: [ 'Lambda Function Invocation Result - Success'],
        detail: { 
          responsePayload: { 
            FunctionName: [ sesFn.functionName ],
            DocumentCount: [ { numeric: [ '>', 0 ] } ]
          }
        }
      },
      targets: [
        new targets.CloudWatchLogGroup(
          new logs.LogGroup(this, 'SesExtractorDestEvents', {
            logGroupName: `/aws/events/${eventBus.eventBusName}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          })
        )
      ]
    });

    // Create SES Email Identity for the domain
    const sesIdentity = new ses.EmailIdentity(this, 'SesIdentity', {
      identity: ses.Identity.publicHostedZone(hostedZone),
    });

    // Create SES rule set for receving emails
    const ruleSet = new ses.ReceiptRuleSet(this, 'SesRuleSet');

    // Add SES rule with actions to process incoming emails
    ruleSet.addRule('ExtractDocs', {
      recipients: [ props.config.mailbox ],
      scanEnabled: true,
      enabled: true,
      tlsPolicy: ses.TlsPolicy.OPTIONAL,
      actions: [
        new actions.S3({
          bucket: mailBucket,
          objectKeyPrefix: 'incoming/',
        }),
        new actions.Lambda({
          function: sesFn,
          invocationType: actions.LambdaInvocationType.EVENT,
        }),
      ],
    });

    // Output for S3 Bucket name
    new cdk.CfnOutput(this, 'SesBucketNameOut', {
      value: mailBucket.bucketName,
      description: 'Name of S3 bucket storing SES emails',
      exportName: 'SesBucketName'
    });

    // Output for S3 Bucket name
    new cdk.CfnOutput(this, 'SesFnNameOut', {
      value: sesFn.functionName,
      description: 'Name of Lambda function for processing',
      exportName: 'SesFnName'
    });

  }
}