import { Construct, SecretValue } from "@aws-cdk/core";
import { PipelineProject, BuildSpec, LinuxBuildImage } from '@aws-cdk/aws-codebuild';
import { Artifact } from "@aws-cdk/aws-codepipeline";
import { CodeBuildAction, GitHubSourceAction } from "@aws-cdk/aws-codepipeline-actions";

interface ClarissaAppDeployProps {
    gitHubToken: SecretValue
}

export class ClarissaApplicationDeploy extends Construct {
    readonly buildAction: CodeBuildAction;
    readonly appBuildOutput: Artifact;
    readonly appSourceAction: GitHubSourceAction;

    constructor(scope: Construct, id: string, props: ClarissaAppDeployProps) {
        super(scope, id);

        const sourceLambdaOutput = new Artifact();
        this.appBuildOutput = new Artifact('LambdaBuildOutput');

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

          this.appSourceAction = new GitHubSourceAction({
            actionName: "LambdaCode_Update",
            output: sourceLambdaOutput,
            "oauthToken": props.gitHubToken,
            "owner": "wandersoulz",
            "repo": "randomname-lambda",
            "branch": "master"
          });

          this.buildAction = new CodeBuildAction({
            actionName: 'Lambda_Build',
            project: lambdaBuild,
            input: sourceLambdaOutput,
            outputs: [this.appBuildOutput],
          });
    }
}