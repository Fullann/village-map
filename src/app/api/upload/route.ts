import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { uploadImageBuffer } from "@/lib/storage";

function validateImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return true;
  }

  // GIF: 47 49 46 38 (GIF87a ou GIF89a)
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return true;
  }

  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return true;
  }

  return false;
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Format invalide. Formats acceptés : JPG, PNG, WEBP, GIF" },
        { status: 400 }
      );
    }

    // Limite stricte à 6 Mo
    if (file.size > 6 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image trop volumineuse (maximum 6 Mo)" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Contrôle approfondi de l'en-tête binaire (Magic Bytes) contre l'usurpation d'extension
    if (!validateImageMagicBytes(buffer)) {
      return NextResponse.json(
        { error: "Contenu de fichier non conforme aux spécifications d'image" },
        { status: 400 }
      );
    }

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
        ? "gif"
        : "jpg";

    const filename = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;

    const publicUrl = await uploadImageBuffer({
      buffer,
      filename,
      contentType: file.type,
    });

    return NextResponse.json({ url: publicUrl, success: true });
  } catch (err) {
    console.error("Erreur upload photo :", err);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement de l'image" },
      { status: 500 }
    );
  }
}
