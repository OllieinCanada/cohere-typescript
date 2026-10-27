import { describe, expect, it } from "vitest";
import { getUrl } from "../../../src/aws-utils";

describe("AWS partition endpoint hosts", () => {
    it.each([
        ["cn-north-1", false],
        ["cn-north-1", true],
        ["cn-northwest-1", false],
        ["cn-northwest-1", true],
    ] as const)("routes SageMaker in %s (stream=%s)", (region, stream) => {
        const url = new URL(getUrl("sagemaker", region, "cohere-endpoint", stream));

        expect(url.hostname).toBe(`runtime.sagemaker.${region}.amazonaws.com.cn`);
        expect(url.pathname).toBe(
            stream ? "/endpoints/cohere-endpoint/invocations-response-stream" : "/endpoints/cohere-endpoint/invocations",
        );
    });

    it.each(["us-east-1", "us-gov-west-1"])("preserves standard and GovCloud hosts in %s", (region) => {
        const sagemaker = new URL(getUrl("sagemaker", region, "cohere-endpoint", false));
        const bedrock = new URL(getUrl("bedrock", region, "cohere-model", false));

        expect(sagemaker.hostname).toBe(`runtime.sagemaker.${region}.amazonaws.com`);
        expect(bedrock.hostname).toBe(`bedrock-runtime.${region}.amazonaws.com`);
    });
});
