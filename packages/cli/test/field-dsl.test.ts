import { describe, expect, it } from "vitest";
import { parseFieldDsl } from "../src/index.js";

describe("@pands/cli field-dsl parser", () => {
  it("parses all supported types, nullable modifiers, and default values", () => {
    const fields = parseFieldDsl(
      "title:string,notes:text?,done:boolean=false,priority:enum(low|medium|high)=medium,dueAt:datetime?,views:int=0,rating:float?,ownerId:uuid",
    );

    expect(fields).toHaveLength(8);

    expect(fields[0]?.name).toBe("title");
    expect(fields[0]?.type).toBe("string");
    expect(fields[0]?.required).toBe(true);
    expect(fields[0]?.drizzleColumnCode).toContain('varchar("title", { length: 255 }).notNull()');

    expect(fields[1]?.name).toBe("notes");
    expect(fields[1]?.type).toBe("text");
    expect(fields[1]?.nullable).toBe(true);
    expect(fields[1]?.required).toBe(false);

    expect(fields[2]?.name).toBe("done");
    expect(fields[2]?.type).toBe("boolean");
    expect(fields[2]?.defaultValue).toBe(false);
    expect(fields[2]?.drizzleColumnCode).toContain(".default(false)");

    expect(fields[3]?.name).toBe("priority");
    expect(fields[3]?.type).toBe("enum");
    expect(fields[3]?.enumValues).toEqual(["low", "medium", "high"]);
    expect(fields[3]?.defaultValue).toBe("medium");

    expect(fields[4]?.name).toBe("dueAt");
    expect(fields[4]?.columnName).toBe("due_at");
    expect(fields[4]?.type).toBe("datetime");
    expect(fields[4]?.nullable).toBe(true);

    expect(fields[5]?.name).toBe("views");
    expect(fields[5]?.type).toBe("int");
    expect(fields[5]?.defaultValue).toBe(0);

    expect(fields[6]?.name).toBe("rating");
    expect(fields[6]?.type).toBe("float");
    expect(fields[6]?.nullable).toBe(true);

    expect(fields[7]?.name).toBe("ownerId");
    expect(fields[7]?.type).toBe("uuid");
    expect(fields[7]?.columnName).toBe("owner_id");
  });

  it("rejects reserved fields and invalid enum defaults", () => {
    expect(() => parseFieldDsl("id:uuid")).toThrow();
    expect(() => parseFieldDsl("status:enum(open|closed)=invalid")).toThrow();
  });
});
