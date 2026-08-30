import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  intakeDefinitionSchema,
  normalizeIntakeAnswers,
  type IntakeDefinition,
} from "@/features/intake/schema";
import { prisma } from "@/lib/prisma";
import {
  projectWhereForAuth,
  type AuthUser,
} from "@/server/authorization";

export class IntakeServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "IntakeServiceError";
  }
}

function parseDefinition(value: Prisma.JsonValue): IntakeDefinition {
  const parsed = intakeDefinitionSchema.safeParse(value);

  if (!parsed.success) {
    throw new IntakeServiceError(
      "This project intake is not configured correctly.",
      500,
    );
  }

  return parsed.data;
}

export async function getProjectIntake(authUser: AuthUser, projectId: string) {
  const project = await prisma.project.findFirst({
    where: projectWhereForAuth(authUser, projectId),
    select: {
      id: true,
      name: true,
      status: true,
      intakeTemplateVersion: {
        select: {
          id: true,
          definition: true,
          publishedAt: true,
          intakeTemplate: {
            select: { name: true, active: true, archivedAt: true },
          },
        },
      },
      intakeSubmissions: {
        where: { status: "SUBMITTED" },
        orderBy: { sequence: "desc" },
        take: 1,
        select: {
          id: true,
          sequence: true,
          status: true,
          definitionSnapshot: true,
          answers: true,
          submittedAt: true,
          submittedBy: { select: { user: { select: { name: true } } } },
        },
      },
    },
  });

  if (!project) {
    throw new IntakeServiceError("Project not found.", 404);
  }

  const submission = project.intakeSubmissions[0] ?? null;
  const definitionValue =
    submission?.definitionSnapshot ?? project.intakeTemplateVersion?.definition;
  const definition = definitionValue ? parseDefinition(definitionValue) : null;
  const templateIsAvailable = Boolean(
    project.intakeTemplateVersion?.publishedAt &&
      project.intakeTemplateVersion.intakeTemplate.active &&
      !project.intakeTemplateVersion.intakeTemplate.archivedAt,
  );

  return {
    project: { id: project.id, name: project.name, status: project.status },
    template: project.intakeTemplateVersion
      ? {
          id: project.intakeTemplateVersion.id,
          name: project.intakeTemplateVersion.intakeTemplate.name,
        }
      : null,
    definition,
    submission: submission
      ? {
          id: submission.id,
          sequence: submission.sequence,
          status: submission.status,
          answers: submission.answers,
          submittedAt: submission.submittedAt,
          submittedBy: submission.submittedBy?.user.name ?? null,
        }
      : null,
    canSubmit:
      authUser.role === "CLIENT" &&
      project.status === "INTAKE" &&
      templateIsAvailable &&
      !submission,
  };
}

export async function submitProjectIntake(
  authUser: AuthUser,
  projectId: string,
  rawAnswers: Record<string, unknown>,
) {
  if (authUser.role !== "CLIENT") {
    throw new IntakeServiceError(
      "Only the associated client can complete this intake.",
      403,
    );
  }

  const project = await prisma.project.findFirst({
    where: projectWhereForAuth(authUser, projectId),
    select: {
      id: true,
      status: true,
      intakeTemplateVersion: {
        select: {
          id: true,
          definition: true,
          publishedAt: true,
          intakeTemplate: { select: { active: true, archivedAt: true } },
        },
      },
    },
  });

  if (!project) {
    throw new IntakeServiceError("Project not found.", 404);
  }

  if (project.status !== "INTAKE") {
    throw new IntakeServiceError(
      "This intake is no longer accepting responses.",
      409,
    );
  }

  const templateVersion = project.intakeTemplateVersion;

  if (
    !templateVersion?.publishedAt ||
    !templateVersion.intakeTemplate.active ||
    templateVersion.intakeTemplate.archivedAt
  ) {
    throw new IntakeServiceError(
      "This project does not have an active intake form.",
      409,
    );
  }

  const definition = parseDefinition(templateVersion.definition);
  const normalized = normalizeIntakeAnswers(definition, rawAnswers);

  if (!normalized.success) {
    throw new IntakeServiceError(
      "Complete the highlighted intake questions.",
      422,
      normalized.fieldErrors,
    );
  }

  const result = await prisma.$transaction(async (transaction) => {
    const existingSubmission = await transaction.intakeSubmission.findFirst({
      where: {
        workspaceId: authUser.workspaceId,
        projectId,
        status: "SUBMITTED",
      },
      select: { id: true },
    });

    if (existingSubmission) {
      throw new IntakeServiceError(
        "This intake has already been submitted.",
        409,
      );
    }

    const transitioned = await transaction.project.updateMany({
      where: {
        id: projectId,
        workspaceId: authUser.workspaceId,
        status: "INTAKE",
      },
      data: { status: "READY" },
    });

    if (transitioned.count !== 1) {
      throw new IntakeServiceError(
        "This intake is no longer accepting responses.",
        409,
      );
    }

    const latestSequence = await transaction.intakeSubmission.aggregate({
      where: { workspaceId: authUser.workspaceId, projectId },
      _max: { sequence: true },
    });
    const sequence = (latestSequence._max.sequence ?? 0) + 1;
    const submission = await transaction.intakeSubmission.create({
      data: {
        workspaceId: authUser.workspaceId,
        projectId,
        intakeTemplateVersionId: templateVersion.id,
        submittedByMembershipId: authUser.membershipId,
        status: "SUBMITTED",
        sequence,
        definitionSnapshot: definition as Prisma.InputJsonValue,
        answers: normalized.data as Prisma.InputJsonValue,
        submittedAt: new Date(),
      },
    });

    await transaction.activity.create({
      data: {
        workspaceId: authUser.workspaceId,
        projectId,
        actorMembershipId: authUser.membershipId,
        action: "INTAKE_SUBMITTED",
        entityType: "IntakeSubmission",
        entityId: submission.id,
        metadata: {
          sequence,
          fromStatus: "INTAKE",
          toStatus: "READY",
        },
        clientVisible: true,
      },
    });

    return submission;
  });

  return getProjectIntake(authUser, result.projectId);
}
