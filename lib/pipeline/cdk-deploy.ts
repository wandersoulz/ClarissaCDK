import { Construct, SecretValue } from "@aws-cdk/core";
import { PipelineProject, BuildSpec, LinuxBuildImage } from '@aws-cdk/aws-codebuild';
import { Artifact } from "@aws-cdk/aws-codepipeline";
import { CodeBuildAction, GitHubSourceAction } from "@aws-cdk/aws-codepipeline-actions";

interface ClarissaCDKDeployProps {
    deploymentStackName: string

    gitHubToken: SecretValue
}

export class ClarissaCDKDeploy extends Construct {
    readonly buildAction: CodeBuildAction;
    readonly cdkBuildOutput: Artifact;
    readonly cdkSourceAction: GitHubSourceAction;

    constructor(scope: Construct, id: string, props: ClarissaCDKDeployProps) {
        super(scope, id);
        
        const sourceCdkOutput = new Artifact();
        this.cdkBuildOutput = new Artifact('CdkBuildOutput');
        
        const cdkBuild = new PipelineProject(this, 'CdkBuild', {
            buildSpec: BuildSpec.fromObject({
              version: '0.2',
              phases: {
                install: {
                  commands: 'npm install'
                },
                build: {
                  commands: [
                    'npm run build',
                    'npm run cdk synth -- -o dist'
                  ]
                }
              },
              artifacts: {
                'base-directory': 'dist',
                files: [
                  `${props.deploymentStackName}.template.json`,
                ],
              }
            }),
            environment: {
              buildImage: LinuxBuildImage.STANDARD_2_0,
            }
        });

        this.cdkSourceAction = new GitHubSourceAction({
            actionName: 'CDKCode_Update',
            output: sourceCdkOutput,
            "oauthToken": props.gitHubToken,
            "owner": "wandersoulz",
            "repo": "ClarissaCDK",
            "branch": "master"
          });

        this.buildAction = new CodeBuildAction({
            actionName: 'CDK_Build',
            project: cdkBuild,
            input: sourceCdkOutput,
            outputs: [this.cdkBuildOutput],
        });
    }
}