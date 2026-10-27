import { describe, expect, it } from "vitest";
import { getUrl } from "../../../src/aws-utils";

describe("AWS model URL paths", () => {
    const arn = "arn:aws:bedrock:us-east-1:123456789012:provisioned-model/abc123";

    it.each([false, true])("encodes an entire model ARN as one path segment (stream=%s)", (stream) => {
        const url = new URL(getUrl("bedrock", "us-east-1", arn, stream));
        const endpoint = stream ? "invoke-with-response-stream" : "invoke";

        expect(url.pathname).toBe(`/model/${encodeURIComponent(arn)}/${endpoint}`);
        expect(url.pathname.split("/")).toHaveLength(4);
        expect(decodeURIComponent(url.pathname.split("/")[2])).toBe(arn);
    });

    it("preserves a simple foundation model ID", () => {
        expect(getUrl("bedrock", "us-east-1", "cohere.embed-english-v3", false)).toBe(
            "https://bedrock-runtime.us-east-1.amazonaws.com/model/cohere.embed-english-v3/invoke",
        );
    });

    it("preserves SageMaker endpoint routing", () => {
        expect(getUrl("sagemaker", "us-east-1", "endpoint-1", true)).toBe(
            "https://runtime.sagemaker.us-east-1.amazonaws.com/endpoints/endpoint-1/invocations-response-stream",
        );
    });
});
