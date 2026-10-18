import { InputError } from "@/lib/input-error";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ImportStatus, Prisma } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ensureDefaultAccount } from "@/lib/finance";
import { analyzeImportFile, type ImportBankFormat, type ImportPreviewData } from "@/lib/import-preview";
import { prisma } from "@/lib/prisma";
import { storeOriginalFile } from "@/lib/import-file";

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
      throw new InputError("La cuenta seleccionada no existe o esta archivada.");
    }
    return account;
  }

  if (accounts.length === 1) {
    return accounts[0];
  }

  throw new InputError("Selecciona la cuenta a la que pertenece este extracto.");
}

function parseForcedFormat(value: FormDataEntryValue | null): ImportBankFormat {
  if (typeof value !== "string") {
    return "AUTO";
  }

  return ["AUTO", "BBVA", "TRADE_REPUBLIC", "ING", "CAIXABANK", "UNSUPPORTED"].includes(value)
    ? (value as ImportBankFormat)
    : "AUTO";
}

function previewResponse(historyId: string, accountName: string, preview: ImportPreviewData) {
  return {
    preview: {
      id: historyId,
      accountName,
      ...preview,
      movements: preview.movements.slice(0, 100).map(({ raw: _raw, ...movement }) => movement)
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");
    const account = await resolveImportAccount(session.user.id, formData.get("accountId"));
    if (account.currency !== "EUR") throw new InputError("El importador admite extractos en EUR. Selecciona una cuenta en EUR; no se convierten divisas automáticamente.");
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

    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo no puede superar los 4 MB." }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(fileBuffer).digest("hex");
    const mimeType = file.type || (isPdf ? "application/pdf" : "text/csv");
    const fileContent = storeOriginalFile(fileBuffer);

    let preview: ImportPreviewData;
    try {
      preview = await analyzeImportFile({ buffer: fileBuffer, fileName: file.name, mimeType, forcedFormat });
    } catch (analysisError) {
      if (!(analysisError instanceof InputError)) return jsonError(analysisError, "No se pudo leer el archivo. Comprueba que no esté dañado, protegido o escaneado.");
      const message = analysisError.message;
      const history = await prisma.importHistory.create({
        data: {
          userId: session.user.id, accountId: account.id, fileName: file.name, fileHash,
          fileSize: file.size, mimeType, fileContent, rowCount: 0, insertedRows: 0, duplicateRows: 0,
          incomeTotal: 0, expenseTotal: 0, status: ImportStatus.FAILED,
          bankName: forcedFormat === "AUTO" ? "Otros" : forcedFormat, detectedFormat: forcedFormat,
          validationStatus: "error", confidence: "baja", validationMessages: [message], errorMessage: message
        }
      });
      return NextResponse.json({ error: message, importId: history.id }, { status: 400 });
    }
      const previousId = formData.get("previousImportId");
      if (typeof previousId === "string") await prisma.importHistory.updateMany({ where: { id: previousId, userId: session.user.id, status: "PENDING" }, data: { status: "FAILED", canceledAt: new Date(), errorMessage: "Sustituido por un nuevo análisis." } });
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
  } catch (error) {
    return jsonError(error, "No se pudo analizar el archivo.");
  }
}
