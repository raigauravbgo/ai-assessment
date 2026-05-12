// LLM scoring client — provider-agnostic. No SDK; just fetch + Zod.
//
// Calls any provider that speaks the OpenAI chat-completions wire format
// (OpenRouter, OpenAI, Together, Groq, Anyscale, local LiteLLM proxy, …).
// Pick the provider via SCORING_BASE_URL + SCORING_API_KEY + SCORING_MODEL.
//
// Defaults: OpenRouter calling Claude Sonnet 4.5. To switch to GPT-4o direct:
//
//   SCORING_BASE_URL=https://api.openai.com/v1
//   SCORING_API_KEY=sk-...
//   SCORING_MODEL=gpt-4o-2024-08-06
//
// Zod v4 has a built-in `toJSONSchema()` so no third-party schema converter
// is needed. We send the JSON Schema via the standard `response_format:
// { type: "json_schema", json_schema: {...} }` field, parse the response as
// JSON, then revalidate with the same Zod schema — so if the model returns
// garbage we surface a clear error instead of silently storing it.

import { z, toJSONSchema } from "zod";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

// OpenAI's "strict" structured-output mode requires every object to declare
// additionalProperties:false and list every property in `required`. Zod's
// default toJSONSchema output doesn't do this — recurse and add it.
// Without strict mode the model often echoes the schema itself instead of
// emitting conformant data; with it, the model is forced to fill the shape.
type JSONSchemaNode = Record<string, unknown>;

function makeStrict(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(makeStrict);
  const s = node as JSONSchemaNode;
  if (s.type === "object" && s.properties && typeof s.properties === "object") {
    const props = s.properties as Record<string, unknown>;
    return {
      ...s,
      additionalProperties: false,
      required: Object.keys(props),
      properties: Object.fromEntries(
        Object.entries(props).map(([k, v]) => [k, makeStrict(v)]),
      ),
    };
  }
  if (s.type === "array" && s.items) {
    return { ...s, items: makeStrict(s.items) };
  }
  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    if (Array.isArray(s[key])) {
      return { ...s, [key]: (s[key] as unknown[]).map(makeStrict) };
    }
  }
  return s;
}

function config() {
  const apiKey = process.env.SCORING_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SCORING_API_KEY is not set. Add it to .env.local — see .env.example.",
    );
  }
  return {
    baseUrl: process.env.SCORING_BASE_URL ?? DEFAULT_BASE_URL,
    apiKey,
    model: process.env.SCORING_MODEL ?? DEFAULT_MODEL,
  };
}

export type ScoreCallResult<T> = {
  parsed: T;
  rawResponse: unknown;
  usage: unknown;
};

export async function scoreWithLLM<S extends z.ZodTypeAny>(args: {
  /** Used as the JSON schema name in the response_format. e.g. "zone". */
  dimensionName: string;
  /** Per-dimension instructions + problem config. */
  systemPrompt: string;
  /** Submission-specific artifacts. */
  userPrompt: string;
  /** Zod schema describing the expected JSON output for this dimension. */
  schema: S;
}): Promise<ScoreCallResult<z.infer<S>>> {
  const { baseUrl, apiKey, model } = config();

  // Zod v4 native JSON Schema conversion + post-process for OpenAI strict mode.
  const jsonSchema = makeStrict(toJSONSchema(args.schema));

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Identification headers — OpenRouter uses these for analytics + rate
      // limit attribution. Harmless on other providers (they're just ignored).
      "HTTP-Referer": process.env.APP_BASE_URL ?? "http://localhost:3000",
      "X-Title": "ai-evaluator",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: args.dimensionName,
          schema: jsonSchema,
          strict: true,
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `scoring "${args.dimensionName}" failed: ${res.status} ${res.statusText}\n${body.slice(0, 800)}`,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: unknown;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error(
      `scoring "${args.dimensionName}": no message.content in response`,
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new Error(
      `scoring "${args.dimensionName}": model returned non-JSON content:\n${content.slice(0, 400)}`,
    );
  }

  const parseResult = args.schema.safeParse(parsedJson);
  if (!parseResult.success) {
    throw new Error(
      `scoring "${args.dimensionName}": JSON failed Zod validation — ${parseResult.error.message}\nRaw: ${content.slice(0, 400)}`,
    );
  }

  return {
    parsed: parseResult.data as z.infer<S>,
    rawResponse: data,
    usage: data.usage ?? null,
  };
}
