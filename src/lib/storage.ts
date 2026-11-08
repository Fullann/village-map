import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHmac, createHash } from "node:crypto";

export interface StorageConfig {
  driver: "local" | "s3";
  s3Endpoint?: string;
  s3Bucket?: string;
  s3Region?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3PublicUrl?: string;
}

export function getStorageConfig(): StorageConfig {
  const s3Endpoint = process.env.S3_ENDPOINT?.trim();
  const s3Bucket = process.env.S3_BUCKET?.trim();
  const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  if (s3Endpoint && s3Bucket && s3AccessKeyId && s3SecretAccessKey) {
    return {
      driver: "s3",
      s3Endpoint,
      s3Bucket,
      s3Region: process.env.S3_REGION?.trim() || "us-east-1",
      s3AccessKeyId,
      s3SecretAccessKey,
      s3PublicUrl: process.env.S3_PUBLIC_URL?.trim(),
    };
  }

  return { driver: "local" };
}

/**
 * Calcule la signature AWS SigV4 pour envoyer un objet vers tout bucket compatible S3
 * (AWS S3, MinIO, Cloudflare R2, Scaleway, Wasabi) sans dépendance externe.
 */
function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string) {
  const kDate = createHmac("sha256", "AWS4" + key).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(regionName).digest();
  const kService = createHmac("sha256", kRegion).update(serviceName).digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  return kSigning;
}

/**
 * Upload d'un fichier vers le stockage configuré (Local ou S3-compatible).
 * Renvoie l'URL publique accessible par le navigateur.
 */
export async function uploadImageBuffer({
  buffer,
  filename,
  contentType,
}: {
  buffer: Buffer;
  filename: string;
  contentType: string;
}): Promise<string> {
  const config = getStorageConfig();

  if (config.driver === "local") {
    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const filepath = join(uploadsDir, filename);
    await writeFile(filepath, buffer);
    return `/uploads/${filename}`;
  }

  // Driver S3 compatible
  const { s3Endpoint, s3Bucket, s3Region, s3AccessKeyId, s3SecretAccessKey, s3PublicUrl } = config;

  const endpointUrl = new URL(s3Endpoint!);
  // Format chemin virtuel ou sous-domaine : path-style vs virtual-hosted
  // On privilégie path-style : endpoint/bucket/key (universel pour MinIO, R2, Scaleway)
  const host = endpointUrl.host;
  const basePath = endpointUrl.pathname.replace(/\/+$/, "");
  const objectPath = `${basePath}/${s3Bucket}/${filename}`;
  const requestUrl = `${endpointUrl.origin}${objectPath}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

  const payloadHash = createHash("sha256").update(buffer).digest("hex");

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest =
    `PUT\n` +
    `${encodeURI(objectPath)}\n` +
    `\n` +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    `${payloadHash}`;

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${s3Region}/s3/aws4_request`;
  const stringToSign =
    `${algorithm}\n` +
    `${amzDate}\n` +
    `${credentialScope}\n` +
    `${createHash("sha256").update(canonicalRequest).digest("hex")}`;

  const signingKey = getSignatureKey(s3SecretAccessKey!, dateStamp, s3Region!, "s3");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const authorizationHeader =
    `${algorithm} ` +
    `Credential=${s3AccessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  const response = await fetch(requestUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      Host: host,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      Authorization: authorizationHeader,
    },
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Échec du téléversement vers S3 (${response.status} ${response.statusText}): ${errorText}`
    );
  }

  if (s3PublicUrl) {
    return `${s3PublicUrl.replace(/\/+$/, "")}/${filename}`;
  }

  return requestUrl;
}
