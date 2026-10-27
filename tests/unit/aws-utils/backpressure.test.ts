import { once } from "node:events";
import type { Readable } from "readable-stream";
import { describe, expect, it, vi } from "vitest";
import { fetchOverride } from "../../../src/aws-utils";

const fakeFetcher = vi.hoisted(() => vi.fn());
vi.mock("../../../src/core", async (importOriginal) => {
    const actual = await importOriginal<object>();
    return { ...actual, fetcher: (...args: unknown[]) => fakeFetcher(...args) };
});

function frame(text: string): Buffer {
    const bytes = Buffer.from(
        JSON.stringify({ event_type: "text-generation", text, is_finished: false }),
    ).toString("base64");
    return Buffer.from(`:event-typeevent{"bytes":"${bytes}"}\n`);
}

function gate() {
    let release: () => void = () => undefined;
    const promise = new Promise<void>((resolve) => {
        release = () => resolve();
    });
    return { promise, release };
}

async function responseWith(body: AsyncIterable<Uint8Array>): Promise<Readable> {
    fakeFetcher.mockResolvedValue({ ok: true, body, rawResponse: { headers: new Headers() } });
    const response = await fetchOverride("bedrock", {
        awsRegion: "us-east-1",
        awsAccessKey: "AKIAIOSFODNN7EXAMPLE",
        awsSecretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    })({
        url: "https://api.cohere.com/v1/chat",
        method: "POST",
        headers: {},
        body: { model: "cohere.command-r-v1", stream: true },
    });
    if (!response.ok) {
        throw new Error("Expected streaming response");
    }
    return response.body as Readable;
}

describe("AWS response backpressure", () => {
    it("does not pull another provider event while a large chunk is unread", async () => {
        const next = gate();
        let secondRequested = false;
        const body = await responseWith({
            async *[Symbol.asyncIterator]() {
                yield frame("x".repeat(256 * 1024));
                secondRequested = true;
                await next.promise;
                yield frame("last");
            },
        });
        try {
            await once(body, "readable");
            expect(secondRequested).toBe(false);
            next.release();
            let received = "";
            for await (const chunk of body) {
                received += chunk.toString();
            }
            expect(received).toContain("last");
            expect(secondRequested).toBe(true);
        } finally {
            next.release();
            body.destroy();
        }
    });

    it("preserves ordinary event order", async () => {
        const body = await responseWith({
            async *[Symbol.asyncIterator]() {
                yield frame("first");
                yield frame("second");
            },
        });
        let received = "";
        for await (const chunk of body) {
            received += chunk.toString();
        }
        expect(received.indexOf("first")).toBeLessThan(received.indexOf("second"));
    });

    it("preserves upstream failures", async () => {
        const body = await responseWith({
            async *[Symbol.asyncIterator]() {
                yield frame("first");
                throw new Error("provider stream failed");
            },
        });
        await expect(async () => {
            for await (const chunk of body) {
                expect(chunk).toBeDefined();
            }
        }).rejects.toThrow("provider stream failed");
    });
});
