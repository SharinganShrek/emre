import { createMcpHandler } from "mcp-handler";
import {
  AI_CORS_HEADERS,
  aiKeysMatch,
  extractAiApiKey,
  getConfiguredAiApiKey,
} from "@/lib/ai/key";
import { EMRE_OS_SERVER_INSTRUCTIONS } from "@/lib/emre-os/playbook";
import { registerEmreOsTools } from "@/lib/emre-os/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const mcp = createMcpHandler(
  (server) => {
    registerEmreOsTools(server);
  },
  {
    serverInfo: { name: "emre-os", version: "1.3.1" },
    instructions: EMRE_OS_SERVER_INSTRUCTIONS,
  },
);

function authorized(request: Request) {
  const configured = getConfiguredAiApiKey();
  const provided = extractAiApiKey(request) ?? "";
  return aiKeysMatch(provided, configured);
}

async function route(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: AI_CORS_HEADERS });
  }
  if (!authorized(request)) {
    return Response.json(
      {
        ok: false,
        error:
          "Missing or invalid api_key. Connect ChatGPT to https://emre-xi.vercel.app/api/mcp?api_key=YOUR_AI_API_KEY",
      },
      { status: 401, headers: AI_CORS_HEADERS },
    );
  }
  const response = await mcp(request);
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(AI_CORS_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export { route as GET, route as POST, route as DELETE };
