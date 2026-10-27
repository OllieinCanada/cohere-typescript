import { describe, expect, it } from "vitest";
import { WebFormData } from "../../../src/core/form-data-utils/FormDataWrapper";

async function uploaded(value: Blob | string, fileName?: string): Promise<File> {
    const form = new WebFormData();
    await form.setup();
    await form.appendFile("file", value, fileName);
    const { body } = form.getRequest();
    const file = (body as FormData).get("file");
    if (!(file instanceof File)) {
        throw new Error("Expected an uploaded file");
    }
    return file;
}

describe("Web multipart file metadata", () => {
    it("preserves Blob media type and the default filename", async () => {
        const file = await uploaded(new Blob(["audio bytes"], { type: "audio/wav" }));

        expect(file.type).toBe("audio/wav");
        expect(file.name).toBe("blob");
        expect(await file.text()).toBe("audio bytes");
    });

    it("preserves Blob media type with an explicit filename", async () => {
        const file = await uploaded(new Blob(["audio bytes"], { type: "audio/wav" }), "clip.wav");

        expect(file.name).toBe("clip.wav");
        expect(file.type).toBe("audio/wav");
        expect(await file.text()).toBe("audio bytes");
    });

    it("preserves native File media type, name, and bytes", async () => {
        const original = new File(["file bytes"], "recording.wav", { type: "audio/wav" });
        const file = await uploaded(original);

        expect(file.name).toBe("recording.wav");
        expect(file.type).toBe("audio/wav");
        expect(await file.text()).toBe("file bytes");
    });

    it("continues accepting raw values with an explicit filename", async () => {
        const file = await uploaded("plain bytes", "raw.txt");

        expect(file.name).toBe("raw.txt");
        expect(file.type).toBe("");
        expect(await file.text()).toBe("plain bytes");
    });
});
