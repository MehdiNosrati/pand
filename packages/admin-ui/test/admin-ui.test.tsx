import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminApp } from "../src/index.js";

describe("@pands/admin-ui", () => {
  it("renders 403 when user is not an admin and renders entity CRUD when user is admin", () => {
    const forbiddenHtml = renderToStaticMarkup(
      <AdminApp
        initialUser={{ id: "u1", email: "user@example.com", role: "user" }}
        initialEntities={[]}
      />,
    );
    expect(forbiddenHtml).toContain("403 Admin role required");

    const adminHtml = renderToStaticMarkup(
      <AdminApp
        initialUser={{ id: "u2", email: "admin@mahdins.dev", role: "admin" }}
        initialEntities={[
          {
            service: "core",
            entity: "Task",
            pluralTitle: "Tasks",
            table: "tasks",
            basePath: "/api/v1/core/tasks",
            primaryKey: "id",
            searchableFields: ["title"],
            fields: [
              { name: "id", label: "Id", type: "uuid", required: true },
              { name: "title", label: "Title", type: "string", required: true },
            ],
          },
        ]}
      />,
    );
    expect(adminHtml).toContain("Pand Admin");
    expect(adminHtml).toContain("Tasks");
    expect(adminHtml).toContain("core.tasks");
  });
});
