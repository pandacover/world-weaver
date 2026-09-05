import { describe, expect, test } from "bun:test";
import {
  buildScreenplaySystemPrompt,
  parseScreenplayJson,
} from "./screenplay.ts";

describe("parseScreenplayJson", () => {
  test("parses raw JSON", () => {
    const screenplay = parseScreenplayJson(
      JSON.stringify({
        title: "Echo Harbor",
        logline: "The sea answers.",
        style: "moody coastal noir",
        scenes: [
          {
            id: "s1",
            title: "Arrival",
            narration: "Fog softens the pier.",
            visualPrompt: "Wide shot of a lonely pier at dusk",
            durationSeconds: 5,
          },
        ],
      }),
    );
    expect(screenplay.title).toBe("Echo Harbor");
    expect(screenplay.scenes).toHaveLength(1);
  });

  test("parses fenced JSON", () => {
    const screenplay = parseScreenplayJson(`\`\`\`json
{"title":"A","logline":"B","style":"C","scenes":[{"id":"s1","title":"T","narration":"N","visualPrompt":"V","durationSeconds":4}]}
\`\`\``);
    expect(screenplay.title).toBe("A");
  });

  test("rejects invalid payloads", () => {
    expect(() => parseScreenplayJson("not json")).toThrow();
  });
});

describe("buildScreenplaySystemPrompt", () => {
  test("includes scene count", () => {
    expect(buildScreenplaySystemPrompt(4)).toContain("Exactly 4 scenes");
  });
});
