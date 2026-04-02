import { insertSupplierPrice } from "../src/lib/db/supplierRepo";
import { mapSupplierProduct } from "../src/lib/pricing/mapSupplier";
import { normalizeToUnitPrice } from "../src/lib/pricing/normalize";
import { scrapeBqProduct } from "./bqScraper";

type BqSyncProduct = {
  url: string;
  externalId: string;
};

const BQ_PRODUCTS: BqSyncProduct[] = [
  {
    url: "https://www.diy.com/departments/goodhome-durable-matt-emulsion-paint-2-5l/5059340960010_BQ.prd",
    externalId: "bq-paint-123"
  },
  {
    url: "https://www.diy.com/departments/goodhome-chadley-natural-oak-effect-laminate-flooring-2-22m2-pack/5059340000000_BQ.prd",
    externalId: "bq-laminate-456"
  },
  {
    url: "https://www.diy.com/departments/cooke-lewis-flatpack-kitchen-base-unit-white-600mm/5059340000001_BQ.prd",
    externalId: "bq-kitchen-001"
  }
];

function infoLog(payload: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ level: "info", ...payload })}\n`);
}

function warnLog(payload: Record<string, unknown>): void {
  process.stderr.write(`${JSON.stringify({ level: "warn", ...payload })}\n`);
}

async function syncOne(item: BqSyncProduct): Promise<void> {
  try {
    const scraped = await scrapeBqProduct(item.url, item.externalId);
    const mapping = mapSupplierProduct(scraped.supplier, scraped.externalId);

    if (!mapping) {
      warnLog({
        event: "supplier_mapping_missing",
        supplier: scraped.supplier,
        externalId: scraped.externalId,
        url: scraped.url
      });
      return;
    }

    const normalized = normalizeToUnitPrice(scraped) * mapping.conversion.multiplier;

    const saved = await insertSupplierPrice({
      supplier: scraped.supplier,
      externalId: scraped.externalId,
      materialId: mapping.materialId,
      price: scraped.price,
      normalizedPrice: Math.round(normalized * 100) / 100,
      unit: scraped.unit,
      createdAt: scraped.updatedAt
    });

    infoLog({
      event: "supplier_price_synced",
      supplier: saved.supplier,
      externalId: saved.externalId,
      materialId: saved.materialId,
      normalizedPrice: saved.normalizedPrice,
      createdAt: saved.createdAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    warnLog({
      event: "supplier_price_sync_failed",
      externalId: item.externalId,
      url: item.url,
      error: message
    });
  }
}

async function runSync(): Promise<void> {
  infoLog({ event: "supplier_sync_started", supplier: "bq", count: BQ_PRODUCTS.length });

  for (const item of BQ_PRODUCTS) {
    await syncOne(item);
  }

  infoLog({ event: "supplier_sync_finished", supplier: "bq" });
}

void runSync();
