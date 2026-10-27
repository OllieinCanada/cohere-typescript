import { createReadStream, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Node16FormData, Node18FormData } from "../../../src/core/form-data-utils/FormDataWrapper";

type StreamBody = {
    on(event: string, listener: (value?: unknown) => void): unknown;
    resume(): unknown;
};

function collect(body: unknown): Promise<Buffer> {
    const stream = body as StreamBody;
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (value) => {
            chunks.push(Buffer.isBuffer(value) ? value : Buffer.from(String(value)));
        });
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.resume();
    });
}

describe.each([
    ["Node18", Node18FormData],
    ["Node16", Node16FormData],
] as const)("%s multipart inputs", (_name, FormDataClass) => {
    it("uploads native filesystem streams without coercing them", async () => {
        const dir = mkdtempSync(join(tmpdir(), "cohere-native-stream-"));
        const path = join(dir, "input.txt");
        writeFileSync(path, "exact streamed file bytes");
        const input = createReadStream(path);
        try {
            const form = new FormDataClass();
            await form.setup();
            await form.appendFile("file", input, "upload.txt");
            const request = await form.getRequest();
            const encoded = (await collect(request.body)).toString();

            expect(encoded).toContain('filename="upload.txt"');
            expect(encoded).toContain("exact streamed file bytes");
            expect(encoded).not.toContain("[object Object]");
        } finally {
            input.destroy();
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("continues uploading Blob bytes", async () => {
        const form = new FormDataClass();
        await form.setup();
        await form.appendFile("file", new Blob(["blob bytes"]), "blob.txt");
        const request = await form.getRequest();
        const encoded = (await collect(request.body)).toString();

        expect(encoded).toContain('filename="blob.txt"');
        expect(encoded).toContain("blob bytes");
    });
});
