import { describe, expect, it } from "vitest";

import {
  intakeDefinitionSchema,
  normalizeIntakeAnswers,
  type IntakeDefinition,
} from "@/features/intake/schema";

const definition: IntakeDefinition = {
  schemaVersion: 1,
  fields: [
    {
      key: "primaryGoal",
      label: "Primary goal",
      type: "longText",
      required: true,
    },
    {
      key: "format",
      label: "Format",
      type: "select",
      required: true,
      options: ["16:9", "9:16"],
    },
    {
      key: "requiredAssets",
      label: "Required assets",
      type: "fileChecklist",
      required: true,
    },
    {
      key: "rightsConfirmed",
      label: "Rights confirmed",
      type: "checkbox",
      required: true,
    },
  ],
};

describe("intake definition and answer validation", () => {
  it("accepts the supported versioned field definition", () => {
    expect(intakeDefinitionSchema.parse(definition)).toEqual(definition);
  });

  it("rejects duplicate field keys and selects without options", () => {
    const parsed = intakeDefinitionSchema.safeParse({
      schemaVersion: 1,
      fields: [
        { key: "goal", label: "Goal", type: "text", required: true },
        { key: "goal", label: "Format", type: "select", required: false },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects unsupported definition versions", () => {
    expect(
      intakeDefinitionSchema.safeParse({
        ...definition,
        schemaVersion: 2,
      }).success,
    ).toBe(false);
  });

  it("normalizes valid answers and ignores unconfigured input", () => {
    const result = normalizeIntakeAnswers(definition, {
      primaryGoal: "  Launch the new product  ",
      format: "16:9",
      requiredAssets: [" logo.svg ", "", "script.docx"],
      rightsConfirmed: true,
      workspaceId: "attempted-override",
    });

    expect(result).toEqual({
      success: true,
      data: {
        primaryGoal: "Launch the new product",
        format: "16:9",
        requiredAssets: ["logo.svg", "script.docx"],
        rightsConfirmed: true,
      },
    });
  });

  it("returns field-specific errors for incomplete or invalid answers", () => {
    const result = normalizeIntakeAnswers(definition, {
      primaryGoal: "",
      format: "square",
      requiredAssets: [],
      rightsConfirmed: false,
    });

    expect(result).toEqual({
      success: false,
      fieldErrors: {
        primaryGoal: "This answer is required.",
        format: "Choose one of the available options.",
        requiredAssets: "Add at least one required asset.",
        rightsConfirmed: "Confirm this item to continue.",
      },
    });
  });
});
