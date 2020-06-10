#!/usr/bin/env node
import 'source-map-support/register';
import { App } from '@aws-cdk/core';
import { ClarissaCdkStack } from '../lib/clarissa-cdk-stack';
import {PipelineStack} from '../lib/pipeline/pipeline';

const app = new App();

const lambdaStack = new ClarissaCdkStack(app, 'ClarissaCdkStack');

new PipelineStack(app, 'PipelineStack', {
    lambdaCode: lambdaStack.lambdaCode,
    appStackName: "ClarissaCdkStack"
});

app.synth()
