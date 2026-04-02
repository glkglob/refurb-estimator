import { Pool } from "pg";
import type { MaterialId } from "../../types/material";
import type { SupplierName, SupplierUnit } from "../../types/supplier";

export type SupplierPriceInsert = {
  supplier: SupplierName;
  externalId: string;
  materialId: MaterialId;
  price: number;
  normalizedPrice: number;
  unit: SupplierUnit;
  createdAt?: string;
};

export type SupplierPriceRecord = {
  id: string;
  supplier: SupplierName;
  externalId: string;
  materialId: MaterialId;
  price: number;
  normalizedPrice: number;
  unit: SupplierUnit;
  createdAt: string;
};

type QueryResultLike = {
  rows: Array<Record<string, unknown>>;
};

type Queryable = {
  query: (sql: string, params: unknown[]) => Promise<QueryResultLike>;
};

type RepositoryDependencies = {
  db?: Queryable;
};

let pool: Pool | null = null;

function getConnectionString(): string {
  const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!connectionString || connectionString.trim().length === 0) {
    throw new Error("SUPABASE_DB_URL or DATABASE_URL must be configured for supplier pricing repository.");
  }
  return connectionString;
}

function getPool(): Pool {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString: getConnectionString(),
    max: 10,
    idleTimeoutMillis: 30_000
  });

  return pool;
}

function resolveDb(dependencies?: RepositoryDependencies): Queryable {
  return dependencies?.db ?? getPool();
}

function toNumber(value: unknown, field: string): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid numeric value for ${field}`);
  }
  return numeric;
}

function mapRowToSupplierPriceRecord(row: Record<string, unknown>): SupplierPriceRecord {
  return {
    id: String(row.id),
    supplier: String(row.supplier) as SupplierName,
    externalId: String(row.external_id),
    materialId: String(row.material_id) as MaterialId,
    price: toNumber(row.price, "price"),
    normalizedPrice: toNumber(row.normalized_price, "normalized_price"),
    unit: String(row.unit) as SupplierUnit,
    createdAt: String(row.created_at)
  };
}

/**
 * Inserts a supplier price row and returns the stored record.
 */
export async function insertSupplierPrice(
  data: SupplierPriceInsert,
  dependencies?: RepositoryDependencies
): Promise<SupplierPriceRecord> {
  const db = resolveDb(dependencies);

  try {
    const createdAt = data.createdAt ?? new Date().toISOString();
    const result = await db.query(
      `INSERT INTO supplier_prices (
        supplier,
        external_id,
        material_id,
        price,
        normalized_price,
        unit,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, supplier, external_id, material_id, price, normalized_price, unit, created_at`,
      [
        data.supplier,
        data.externalId,
        data.materialId,
        data.price,
        data.normalizedPrice,
        data.unit,
        createdAt
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Insert supplier price returned no rows");
    }

    return mapRowToSupplierPriceRecord(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database insert failure";
    throw new Error(`Failed to insert supplier price: ${message}`);
  }
}

/**
 * Fetches the latest supplier price for a material.
 */
export async function getLatestSupplierPrice(
  materialId: MaterialId,
  dependencies?: RepositoryDependencies
): Promise<SupplierPriceRecord | null> {
  const db = resolveDb(dependencies);

  try {
    const result = await db.query(
      `SELECT id, supplier, external_id, material_id, price, normalized_price, unit, created_at
       FROM supplier_prices
       WHERE material_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [materialId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return mapRowToSupplierPriceRecord(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database read failure";
    throw new Error(`Failed to fetch supplier price: ${message}`);
  }
}
