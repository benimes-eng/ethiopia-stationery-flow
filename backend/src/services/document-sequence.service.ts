import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { documentSequences } from "../db/schema/system.js";

export async function getNextSequenceNumber(
  tenantId: string,
  documentType: string,
  prefix: string,
  txClient = db
): Promise<string> {
  // Use atomic SQL UPSERT with RETURNING to guarantee zero collisions
  const result = await txClient
    .insert(documentSequences)
    .values({
      id: `seq-${tenantId}-${documentType.toLowerCase()}`,
      tenantId,
      documentType,
      prefix,
      currentNumber: 1001,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [documentSequences.tenantId, documentSequences.documentType],
      set: {
        currentNumber: sql`${documentSequences.currentNumber} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({
      prefix: documentSequences.prefix,
      number: documentSequences.currentNumber,
    });

  const row = result[0];
  if (!row) {
    throw new Error(`Failed to generate sequence number for ${documentType}`);
  }

  return `${row.prefix}${row.number}`;
}
