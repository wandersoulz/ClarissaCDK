import { PipelineProject, BuildSpec, LinuxBuildImage } from '@aws-cdk/aws-codebuild';
import { Pipeline, Artifact } from '@aws-cdk/aws-codepipeline';
import { GitHubSourceAction, CodeBuildAction, CloudFormationCreateUpdateStackAction, GitHubTrigger } from '@aws-cdk/aws-codepipeline-actions';
import { CfnParametersCode } from '@aws-cdk/aws-lambda';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { App, Stack, StackProps } from '@aws-cdk/core';

export interface PipelineStackProps extends StackProps {
  readonly lambdaCode: CfnParametersCode;

  readonly lambdaStackName: string
}

export class PipelineStack extends Stack {
    constructor(app: App, id: string, props: PipelineStackProps) {
      super(app, id, props);
  
      const cdkBuild = new PipelineProject(this, 'CdkBuild', {
        buildSpec: BuildSpec.fromObject({
          version: '0.2',
          phases: {
            install: {
              commands: 'npm install',
            },
            build: {
              commands: [
                'npm run build',
                'npm run cdk synth -- -o dist'
              ],
            },
          },
          artifacts: {
            'base-directory': 'dist',
            files: [
              `${props.lambdaStackName}.template.json`,
            ],
          },
        }),
        environment: {
          buildImage: LinuxBuildImage.STANDARD_2_0,
        },
      });

      const lambdaBuild = new PipelineProject(this, 'LambdaBuild', {
        buildSpec: BuildSpec.fromObject({
          version: '0.2',
          phases: {
            install: {
              commands: [
                'echo CODEBUILD_SRC_DIR - $CODEBUILD_SRC_DIR',
                'echo GOPATH - $GOPATH',
                'echo GOROOT - $GOROOT'
              ],
            },
            build: {
              commands: [
                  'echo Build started on `date`',
                  'echo Getting packages',
                  'go get github.com/aws/aws-lambda-go/lambda',
                  'go get github.com/wandersoulz/randomname',
                  'echo Compiling the Go code...',
                  'go build main.go'
              ]
            },
          },
          artifacts: {
            files: [
              'main',
              'first-names.txt'
            ]
          },
        }),
        environment: {
          buildImage: LinuxBuildImage.STANDARD_2_0
        },
      });
  
      const sourceCdkOutput = new Artifact();
      const sourceLambdaOutput = new Artifact();
      const cdkBuildOutput = new Artifact('CdkBuildOutput');
      const lambdaBuildOutput = new Artifact('LambdaBuildOutput');
      const gitHubToken = Secret.fromSecretArn(this, "GitHubTokenSecret", "arn:aws:secretsmanager:us-east-1:399907205041:secret:GitHubToken-3oX8nW").secretValue
      const gitHubOwner = "wandersoulz";
      new Pipeline(this, 'Pipeline', {
        stages: [
          {
            stageName: 'Source',
            actions: [
              new GitHubSourceAction({
                actionName: 'CDKCode_Update',
                output: sourceCdkOutput,
                "oauthToken": gitHubToken,
                "owner": gitHubOwner,
                "repo": "ClarissaCDK"
              }),
              new GitHubSourceAction({
                actionName: "LambdaCode_Update",
                output: sourceLambdaOutput,
                "oauthToken": gitHubToken,
                "owner": gitHubOwner,
                "repo": "randomname-lambda"
              })
            ],
          },
          {
            stageName: 'Build',
            actions: [
              new CodeBuildAction({
                actionName: 'Lambda_Build',
                project: lambdaBuild,
                input: sourceLambdaOutput,
                outputs: [lambdaBuildOutput],
              }),
              new CodeBuildAction({
                actionName: 'CDK_Build',
                project: cdkBuild,
                input: sourceCdkOutput,
                outputs: [cdkBuildOutput],
              }),
            ],
          },
          {
            stageName: 'Deploy',
            actions: [
              new CloudFormationCreateUpdateStackAction({
                actionName: 'Lambda_CFN_Deploy',
                templatePath: cdkBuildOutput.atPath(`${props.lambdaStackName}.template.json`),
                stackName: props.lambdaStackName,
                adminPermissions: true,
                parameterOverrides: {
                  ...props.lambdaCode.assign(lambdaBuildOutput.s3Location),
                },
                extraInputs: [lambdaBuildOutput],
              }),
            ],
          },
        ],
      });
    }
  }