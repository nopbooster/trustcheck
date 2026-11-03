import { describe, expect, it } from "vitest";
import { parseRiskyToolsConfig } from "./index";

describe("parseRiskyToolsConfig", () => {
  it("parses the YAML format from the guide", () => {
    const cfg = parseRiskyToolsConfig(`
send_email:   { check: [to] }
http_request: { check: [url] }
delete_file:
  check: [path]
`);
    expect(cfg).toEqual({
      send_email: { check: ["to"] },
      http_request: { check: ["url"] },
      delete_file: { check: ["path"] },
    });
  });

  it("treats an empty file as no risky tools", () => {
    expect(parseRiskyToolsConfig("")).toEqual({});
  });

  it("rejects invalid shapes", () => {
    expect(() => parseRiskyToolsConfig("send_email: { check: to }")).toThrow();
    expect(() => parseRiskyToolsConfig("send_email: { check: [] }")).toThrow();
  });
});
