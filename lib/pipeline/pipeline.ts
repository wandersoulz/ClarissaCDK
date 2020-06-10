import { PipelineProject, BuildSpec, LinuxBuildImage } from '@aws-cdk/aws-codebuild';
import { Pipeline, Artifact } from '@aws-cdk/aws-codepipeline';
import { GitHubSourceAction, CodeBuildAction, CloudFormationCreateUpdateStackAction, GitHubTrigger } from '@aws-cdk/aws-codepipeline-actions';
import { CfnParametersCode } from '@aws-cdk/aws-lambda';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { App, Stack, StackProps } from '@aws-cdk/core';
import { ClarissaCDKDeploy } from './cdk-deploy';
import { ClarissaApplicationDeploy } from './app-deploy';

export interface PipelineStackProps extends StackProps {
  readonly lambdaCode: CfnParametersCode;

  readonly appStackName: string
}

export class PipelineStack extends Stack {
    constructor(app: App, id: string, props: PipelineStackProps) {
      super(app, id, props);
      const gitHubToken = Secret.fromSecretArn(this, "GitHubTokenSecret", "arn:aws:secretsmanager:us-east-1:399907205041:secret:GitHubTokenString-bofHoJ").secretValue;
  
      const cdkDeploy = new ClarissaCDKDeploy(this, "ClarissaCDKDeploy", {
        deploymentStackName: props.appStackName,
        gitHubToken
      });

      const appDeploy = new ClarissaApplicationDeploy(this, "AppDeploy", {
        gitHubToken
      });

      new Pipeline(this, 'Pipeline', {
        stages: [
          {
            stageName: 'Source',
            actions: [
              appDeploy.appSourceAction,
              cdkDeploy.cdkSourceAction
            ],
          },
          {
            stageName: 'Build',
            actions: [
              appDeploy.buildAction,
              cdkDeploy.buildAction
            ]
          },
          {
            stageName: 'Deploy',
            actions: [
              new CloudFormationCreateUpdateStackAction({
                actionName: 'Lambda_CFN_Deploy',
                templatePath: cdkDeploy.cdkBuildOutput.atPath(`${props.appStackName}.template.json`),
                stackName: props.appStackName,
                adminPermissions: true,
                parameterOverrides: {
                  ...props.lambdaCode.assign(appDeploy.appBuildOutput.s3Location),
                },
                extraInputs: [appDeploy.appBuildOutput]
              }),
            ],
          },
        ],
      });
    }
  }