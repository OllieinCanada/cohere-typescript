import { describe, expect, it } from "vitest";
import { getAuthHeaders } from "../../../src/aws-utils";

const url = new URL("https://bedrock-runtime.us-east-1.amazonaws.com/model/cohere.command-r-v1/invoke");
const credentials = {
    awsRegion: "us-east-1",
    awsAccessKey: "AKIAIOSFODNN7EXAMPLE",
    awsSecretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
};

describe("AWS signing header normalization", () => {
    it.each([
        ["Host", "Connection"],
        ["hOsT", "CoNnEcTiOn"],
    ])("replaces %s and removes %s case-insensitively", async (host, connection) => {
        const signed = await getAuthHeaders(
            url,
            "POST",
            { [host]: "api.cohere.com", [connection]: "keep-alive", "content-type": "application/json" },
            "{}",
            "bedrock",
            credentials,
        );
        const headers = new Headers(signed);

        expect(headers.get("host")).toBe(url.hostname);
        expect(headers.has("connection")).toBe(false);
        expect(Object.keys(signed).filter((key) => key.toLowerCase() === "host")).toHaveLength(1);
        expect(headers.get("authorization")).toContain("AWS4-HMAC-SHA256");
    });

    it("preserves ordinary signed headers", async () => {
        const signed = await getAuthHeaders(
            url,
            "POST",
            { host: "api.cohere.com", connection: "keep-alive", "x-custom": "kept" },
            "{}",
            "bedrock",
            credentials,
        );
        const headers = new Headers(signed);

        expect(headers.get("host")).toBe(url.hostname);
        expect(headers.get("x-custom")).toBe("kept");
        expect(headers.has("connection")).toBe(false);
    });
});
