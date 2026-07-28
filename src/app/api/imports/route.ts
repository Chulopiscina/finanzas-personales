import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ImportStatus, Prisma } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ensureDefaultAccount } from "@/lib/finance";
import { analyzeImportFile, type ImportBankFormat, type ImportPreviewData } from "@/lib/import-preview";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

async function resolveImportAccount(userId: string, requestedAccountId: FormDataEntryValue | null) {
  const accounts = await prisma.account.findMany({ where: { userId, isArchived: false }, orderBy: { createdAt: "asc" } });
  if (accounts.length === 0) {
    return ensureDefaultAccount(userId);
  }

  const requested = typeof requestedAccountId === "string" ? requestedAccountId : "";
  if (requested) {
    const account = accounts.find((item) => item.id === requested);
    if (!account) {
      throw new Error("La cuenta seleccionada no existe o esta archivada.");
    }
    return account;
  }

  if (accounts.length === 1) {
    return accounts[0];
  }

  throw new Error("Selecciona la cuenta a la que pertenece este extracto.");
}

function parseForcedFormat(value: FormDataEntryValue | null): ImportBankFormat {
  if (typeof value !== "string") {
    return "AUTO";
  }

  return ["AUTO", "BBVA", "TRADE_REPUBLIC", "ING", "CAIXABANK", "UNSUPPORTED"].includes(value)
    ? (value as ImportBankFormat)
    : "AUTO";
}

function storedFileContent(buffer: Buffer, isCsv: boolean) {
  return isCsv ? buffer.toString("utf8") : buffer.toString("base64");
}

function previewResponse(historyId: string, accountName: string, preview: ImportPreviewData) {
  return {
    preview: {
      id: historyId,
      accountName,
      ...preview
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");
    const account = await resolveImportAccount(session.user.id, formData.get("accountId"));
    const forcedFormat = parseForcedFormat(formData.get("bankFormat"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Debes subir un archivo CSV o PDF." }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith(".csv") || file.type === "text/csv";
    const isPdf = lowerName.endsWith(".pdf") || file.type === "application/pdf";

    if (!isCsv && !isPdf) {
      return NextResponse.json({ error: "El archivo debe ser CSV o PDF." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo no puede superar los 10 MB." }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(fileBuffer).digest("hex");
    const mimeType = file.type || (isPdf ? "application/pdf" : "text/csv");
    const fileContent = storedFileContent(fileBuffer, isCsv);

    try {
      const preview = await analyzeImportFile({ buffer: fileBuffer, fileName: file.name, mimeType, forcedFormat });
      const history = await prisma.importHistory.create({
        data: {
          userId: session.user.id,
          accountId: account.id,
          fileName: file.name,
          fileHash,
          fileSize: file.size,
          mimeType,
          fileContent,
          rowCount: preview.rowCount,
          insertedRows: 0,
          duplicateRows: 0,
          incomeTotal: preview.incomeTotal,
          expenseTotal: preview.expenseTotal,
          status: ImportStatus.PENDING,
          bankName: preview.bankName,
          detectedFormat: preview.detectedFormat,
          validationStatus: preview.validationStatus,
          confidence: preview.confidence,
          validationMessages: preview.messages,
          previewData: preview as unknown as Prisma.InputJsonValue
        }
      });

      return NextResponse.json(previewResponse(history.id, account.name, preview));
    } catch (analysisError) {
      const message = analysisError instanceof Error ? analysisError.message : "No se pudo analizar el archivo.";
      const history = await prisma.importHistory.create({
        data: {
          userId: session.user.id,
          accountId: account.id,
          fileName: file.name,
          fileHash,
          fileSize: file.size,
          mimeType,
          fileContent,
          rowCount: 0,
          insertedRows: 0,
          duplicateRows: 0,
          incomeTotal: 0,
          expenseTotal: 0,
          status: ImportStatus.FAILED,
          bankName: forcedFormat === "AUTO" ? "Otros" : forcedFormat,
          detectedFormat: forcedFormat,
          validationStatus: "error",
          confidence: "baja",
          validationMessages: [message],
          errorMessage: message
        }
      });

      return NextResponse.json({ error: message, importId: history.id }, { status: 400 });
    }
  } catch (error) {
    return jsonError(error, "No se pudo analizar el archivo.");
  }
}