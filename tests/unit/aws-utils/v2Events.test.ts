import { describe, expect, it, vi } from "vitest";
import { fetchOverride, parseAWSEvent } from "../../../src/aws-utils";

const fakeFetcher = vi.hoisted(() => vi.fn());
vi.mock("../../../src/core", async (importOriginal) => {
    const actual = await importOriginal<object>();
    return { ...actual, fetcher: (...args: unknown[]) => fakeFetcher(...args) };
});

function frame(event: unknown): Buffer {
    const bytes = Buffer.from(JSON.stringify(event)).toString("base64");
    return Buffer.from(`:event-typeevent{"bytes":"${bytes}"}\n`);
}

const delta = {
    type: "content-delta",
    index: 0,
    delta: { message: { content: { text: "hello from v2" } } },
};

describe("AWS V2 streaming events", () => {
    it("recognizes the V2 type discriminator", () => {
        expect(parseAWSEvent(frame(delta).toString())).toEqual(delta);
    });

    it("preserves V1 event_type payloads", () => {
        const event = { event_type: "text-generation", text: "hello", is_finished: false };
        expect(parseAWSEvent(frame(event).toString())).toEqual(event);
    });

    it("delivers a V2 content delta through the mapped response body", async () => {
        fakeFetcher.mockResolvedValue({
            ok: true,
            body: {
                async *[Symbol.asyncIterator]() {
                    yield frame(delta);
                },
            },
            rawResponse: { headers: new Headers() },
        });
        const response = await fetchOverride("bedrock", {
            awsRegion: "us-east-1",
            awsAccessKey: "AKIAIOSFODNN7EXAMPLE",
            awsSecretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        })({
            url: "https://api.cohere.com/v2/chat",
            method: "POST",
            headers: {},
            body: { model: "cohere.command-r-plus-v1:0", stream: true },
        });
        if (!response.ok) {
            throw new Error("Expected a successful mapped response");
        }
        const events = [];
        for await (const chunk of response.body as AsyncIterable<Buffer>) {
            events.push(JSON.parse(chunk.toString()));
        }
        expect(events).toEqual([delta]);
    });
});
