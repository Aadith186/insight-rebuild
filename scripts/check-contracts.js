import fs from "node:fs";
import assert from "node:assert/strict";
import { createApp } from "../server/src/app.js";
import { registered } from "../server/src/core/http.js";
import * as M from "../server/src/models.js";
export function jsonSchema(s) {
  if (!s) return {};
  const d = s._def;
  switch (d.typeName) {
    case "ZodOptional":
    case "ZodDefault":
      return jsonSchema(d.innerType);
    case "ZodEffects":
      return jsonSchema(d.schema);
    case "ZodNullable":
      return { anyOf: [jsonSchema(d.innerType), { type: "null" }] };
    case "ZodString": {
      const o = { type: "string" };
      for (const c of d.checks || []) {
        if (c.kind === "min") o.minLength = c.value;
        if (c.kind === "max") o.maxLength = c.value;
        if (["email", "url", "datetime"].includes(c.kind))
          o.format = { email: "email", url: "uri", datetime: "date-time" }[
            c.kind
          ];
        if (c.kind === "regex") o.pattern = c.regex.source;
      }
      return o;
    }
    case "ZodNumber": {
      const o = {
        type: d.checks.some((c) => c.kind === "int") ? "integer" : "number",
      };
      for (const c of d.checks) {
        if (c.kind === "min") o.minimum = c.value;
        if (c.kind === "max") o.maximum = c.value;
      }
      return o;
    }
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodLiteral":
      return { const: d.value, type: typeof d.value };
    case "ZodEnum":
      return { type: "string", enum: d.values };
    case "ZodArray":
      return {
        type: "array",
        items: jsonSchema(d.type),
        ...(d.minLength ? { minItems: d.minLength.value } : {}),
        ...(d.maxLength ? { maxItems: d.maxLength.value } : {}),
      };
    case "ZodObject": {
      const shape = d.shape();
      return {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(shape).map(([k, v]) => [k, jsonSchema(v)]),
        ),
        required: Object.entries(shape)
          .filter(([k, v]) => !v.isOptional())
          .map(([k]) => k),
        additionalProperties: d.unknownKeys !== "strict",
      };
    }
    case "ZodDiscriminatedUnion":
      return {
        oneOf: [...d.optionsMap.values()]
          .filter((x, i, a) => a.indexOf(x) === i)
          .map(jsonSchema),
        discriminator: { propertyName: d.discriminator },
      };
    case "ZodUnion":
      return { anyOf: d.options.map(jsonSchema) };
    default:
      throw new Error("Undocumented schema type " + d.typeName);
  }
}
createApp();
const specs = JSON.parse(fs.readFileSync("docs/route-catalogue.json")),
  actual = new Set(registered.map((r) => r.method + " " + r.path));
assert.equal(actual.size, 191);
assert.equal(registered.length, 191);
assert.equal(Object.keys(M).length, 45);
for (const s of specs)
  assert(actual.has(s.method + " " + s.path), "Missing " + s.path);
const paths = {},
  schemas = {
    Error: {
      type: "object",
      properties: {
        error: {
          type: "object",
          properties: {
            code: { type: "string" },
            message: { type: "string" },
            fieldErrors: { type: "array", items: {} },
            requestId: { type: "string" },
          },
        },
      },
    },
  };
for (const s of specs) {
  const r = registered.find((r) => r.method === s.method && r.path === s.path),
    p = s.path.replace(/:(\w+)/g, "{$1}"),
    parameters = [...s.path.matchAll(/:(\w+)/g)].map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: {
        type: "string",
        ...(m[1] !== "token" ? { pattern: "^[a-fA-F0-9]{24}$" } : {}),
      },
    }));
  if (!r.public)
    parameters.push({
      name: "X-Organization-Id",
      in: "header",
      required: false,
      schema: { type: "string" },
      description:
        "Active organization membership. Client context is further narrowed by X-Client-Id.",
    });
  if (r.idempotent)
    parameters.push({
      name: "Idempotency-Key",
      in: "header",
      required: true,
      schema: { type: "string", maxLength: 150 },
    });
  const op = {
    operationId: s.id,
    summary: s.contract,
    description: s.guard,
    tags: [s.path.split("/")[1]],
    security: r.public ? [] : [{ sessionCookie: [] }],
    parameters,
    responses: {
      200: {
        description: "Successful response; data envelope with request ID.",
      },
      201: { description: "Created resource." },
      204: { description: "Removed or revoked." },
      401: { description: "Authentication required" },
      403: { description: "Forbidden" },
      404: { description: "Resource unavailable" },
      409: { description: "State/version/idempotency conflict" },
      422: { description: "Validation error" },
      503: { description: "Required service unavailable" },
    },
  };
  if (r.schema) {
    schemas[s.id + "Request"] = jsonSchema(r.schema);
    op.requestBody = {
      required: true,
      content: {
        [s.path === "/media/assets"
          ? "multipart/form-data"
          : "application/json"]: {
          schema: { $ref: "#/components/schemas/" + s.id + "Request" },
        },
      },
    };
    if (s.path === "/media/assets") {
      schemas[s.id + "Request"].properties.file = {
        type: "string",
        format: "binary",
      };
      schemas[s.id + "Request"].required.push("file");
    }
  }
  if (r.method === "GET" && !s.path.includes("/health/"))
    parameters.push(
      ...[
        "cursor",
        "limit",
        "state",
        "clientId",
        "campaignId",
        "search",
        "niche",
        "city",
        "from",
        "to",
      ].map((name) => ({
        name,
        in: "query",
        required: false,
        schema: { type: name === "limit" ? "integer" : "string" },
      })),
    );
  paths[p] ??= {};
  paths[p][s.method.toLowerCase()] = op;
}
fs.writeFileSync(
  "docs/openapi.json",
  JSON.stringify(
    {
      openapi: "3.1.0",
      info: { title: "Insight API", version: "2.0.0" },
      servers: [{ url: "/api/v1" }],
      components: {
        securitySchemes: {
          sessionCookie: {
            type: "apiKey",
            in: "cookie",
            name: "insight_session",
          },
        },
        schemas,
      },
      paths,
    },
    null,
    2,
  ),
);
console.log(
  "45 models and 191 route registrations match. OpenAPI includes the actual strict request schemas. Database workflows are not executed by this check.",
);
