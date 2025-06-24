import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as EmailWrangler from "../lib/email-wrangler-stack";

test("All required resources created", () => {
  const app = new cdk.App();
  const stack = new EmailWrangler.EmailWranglerStack(app, "EmailWranglerTestStack");
  const template = Template.fromStack(stack);

  template.hasResource("AWS::S3::Bucket", {});
  template.hasResource("AWS::Lambda::Function", {});
  template.hasResource("AWS::SES::EmailIdentity", {});
  template.hasResource("AWS::SES::ReceiptRuleSet", {});
  template.hasResource("AWS::SES::ReceiptRule", {});
  template.hasResource("AWS::Events::EventBus", {});
  template.hasResource("AWS::Events::Rule", {});
});
