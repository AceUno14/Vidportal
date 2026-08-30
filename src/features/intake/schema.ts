import { z } from "zod";

const intakeFieldTypeSchema = z.enum([
  "text",
  "longText",
  "select",
  "checkbox",
  "fileChecklist",
]);

const intakeFieldSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-zA-Z0-9_]*$/),
  label: z.string().trim().min(1).max(120),
  type: intakeFieldTypeSchema,
  required: z.boolean().default(false),
  help: z.string().trim().max(300).optional(),
  placeholder: z.string().trim().max(200).optional(),
  options: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
});

export const intakeDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    fields: z.array(intakeFieldSchema).min(1).max(50),
  })
  .superRefine((definition, context) => {
    const keys = new Set<string>();

    for (const [index, field] of definition.fields.entries()) {
      if (keys.has(field.key)) {
        context.addIssue({
          code: "custom",
          path: ["fields", index, "key"],
          message: "Field keys must be unique.",
        });
      }

      keys.add(field.key);

      if (field.type === "select" && !field.options?.length) {
        context.addIssue({
          code: "custom",
          path: ["fields", index, "options"],
          message: "Select fields require at least one option.",
        });
      }
    }
  });

export const intakeSubmissionRequestSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
});

export type IntakeDefinition = z.infer<typeof intakeDefinitionSchema>;
export type IntakeField = IntakeDefinition["fields"][number];
export type NormalizedIntakeAnswers = Record<
  string,
  string | boolean | string[]
>;

type IntakeAnswerResult =
  | { success: true; data: NormalizedIntakeAnswers }
  | { success: false; fieldErrors: Record<string, string> };

function normalizedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeIntakeAnswers(
  definition: IntakeDefinition,
  answers: Record<string, unknown>,
): IntakeAnswerResult {
  const normalized: NormalizedIntakeAnswers = {};
  const fieldErrors: Record<string, string> = {};

  for (const field of definition.fields) {
    const value = answers[field.key];

    if (field.type === "checkbox") {
      const checked = value === true;
      normalized[field.key] = checked;

      if (field.required && !checked) {
        fieldErrors[field.key] = "Confirm this item to continue.";
      }

      continue;
    }

    if (field.type === "fileChecklist") {
      const items = Array.isArray(value)
        ? value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

      if (items.length > 50 || items.some((item) => item.length > 255)) {
        fieldErrors[field.key] = "List up to 50 assets, one per line.";
      } else if (field.required && items.length === 0) {
        fieldErrors[field.key] = "Add at least one required asset.";
      }

      normalized[field.key] = items;
      continue;
    }

    const valueAsText = normalizedString(value);

    if (field.required && !valueAsText) {
      fieldErrors[field.key] = "This answer is required.";
    } else if (valueAsText.length > 5_000) {
      fieldErrors[field.key] = "Keep this answer under 5,000 characters.";
    } else if (
      field.type === "select" &&
      valueAsText &&
      !field.options?.includes(valueAsText)
    ) {
      fieldErrors[field.key] = "Choose one of the available options.";
    }

    normalized[field.key] = valueAsText;
  }

  return Object.keys(fieldErrors).length
    ? { success: false, fieldErrors }
    : { success: true, data: normalized };
}
