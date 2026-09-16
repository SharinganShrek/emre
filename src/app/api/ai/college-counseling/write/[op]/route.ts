import { AiPermissionError } from "@/lib/ai/permissions";
import { aiCatch, aiError } from "@/lib/ai/response";
import { runCounselingWrite } from "@/lib/college-counseling/ai";
import { normalizeCollegeItemWrite, foldEnvelope } from "@/lib/college-counseling/write-normalize";
import type { CollegeCounselingWrite } from "@/lib/validation";
import {
  collegeWriteAddActivityBody,
  collegeWriteAddItemBody,
  collegeWriteDeleteItemBody,
  collegeWriteDocumentBody,
  collegeWriteItemBody,
  collegeWriteNotesBody,
  collegeWriteProfileBody,
  collegeProfilePatch,
  collegeWriteTestingBody,
  collegeWriteUpdateActivityBody,
  collegeWriteUpdateItemBody,
} from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPS = [
  "profile",
  "testing",
  "document",
  "notes",
  "item",
  "add-item",
  "update-item",
  "delete-item",
  "add-activity",
  "update-activity",
] as const;

type Op = (typeof OPS)[number];

function isOp(value: string): value is Op {
  return (OPS as readonly string[]).includes(value);
}

function bodyForOp(op: Op, json: unknown): CollegeCounselingWrite {
  switch (op) {
    case "profile": {
      collegeWriteProfileBody.parse(json);
      const patch = collegeProfilePatch.parse(foldEnvelope(json, "patch"));
      if (Object.keys(patch).length === 0) {
        throw new AiPermissionError("patch is required", 422);
      }
      return { action: "update_profile", patch };
    }
    case "testing": {
      const body = collegeWriteTestingBody.parse(json);
      return { action: "update_testing", testing: body.testing };
    }
    case "document": {
      collegeWriteDocumentBody.parse(json);
      const data = foldEnvelope(json, "data");
      if (Object.keys(data).length === 0) {
        throw new AiPermissionError("data is required", 422);
      }
      return { action: "patch", data };
    }
    case "notes": {
      const body = collegeWriteNotesBody.parse(json);
      return {
        action: "update_section",
        section: body.field,
        data: body.text,
      };
    }
    case "item": {
      collegeWriteItemBody.parse(json);
      try {
        return normalizeCollegeItemWrite(json);
      } catch (err) {
        throw new AiPermissionError(
          err instanceof Error ? err.message : "Invalid counseling item write",
          422,
        );
      }
    }
    case "add-item": {
      const body = collegeWriteAddItemBody.parse(json);
      return { action: "add_item", section: body.section, item: body.item };
    }
    case "update-item": {
      const body = collegeWriteUpdateItemBody.parse(json);
      return {
        action: "update_item",
        section: body.section,
        id: body.id,
        patch: body.patch,
      };
    }
    case "delete-item": {
      const body = collegeWriteDeleteItemBody.parse(json);
      return {
        action: "delete_item",
        section: body.section,
        id: body.id,
      };
    }
    case "add-activity": {
      const body = collegeWriteAddActivityBody.parse(json);
      return { action: "add_activity", activity: body.activity };
    }
    case "update-activity": {
      const body = collegeWriteUpdateActivityBody.parse(json);
      return {
        action: "update_activity",
        id: body.id,
        patch: body.patch,
      };
    }
  }
}

/**
 * POST /api/ai/college-counseling/write/:op
 * ChatGPT Actions cannot import oneOf request bodies; each op is a plain object.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ op: string }> },
) {
  try {
    const { op } = await context.params;
    if (!isOp(op)) {
      return aiError(`Unknown counseling write operation "${op}".`, 404);
    }
    const body = bodyForOp(op, await request.json());
    return runCounselingWrite(request, body);
  } catch (err) {
    return aiCatch(err);
  }
}
