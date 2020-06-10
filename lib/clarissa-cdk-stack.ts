import { Code, Function, Runtime, CfnParametersCode } from '@aws-cdk/aws-lambda';
import { App, Stack, StackProps } from '@aws-cdk/core';

export class ClarissaCdkStack extends Stack {
  public readonly lambdaCode: CfnParametersCode;

  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    this.lambdaCode = Code.fromCfnParameters();
      
    new Function(this, 'RandomNameGenerator', {
      code: this.lambdaCode,
      handler: 'main',
      runtime: Runtime.GO_1_X,
      environment: {
        "CONTEXT_SIZE": "5"
      },
      functionName: "RandomNameGenerator"
    });
  }
}
