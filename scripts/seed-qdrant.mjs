/**
 * seed-qdrant.mjs
 *
 * Creates the Qdrant `properties` collection and seeds it with representative
 * UK refurbishment property listings.
 *
 * Usage (from project root):
 *   node scripts/seed-qdrant.mjs
 *
 * Requires QDRANT_URL, QDRANT_API_KEY, OPENAI_API_KEY in .env (root).
 * Override collection name with QDRANT_PROPERTIES_COLLECTION.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Load .env (no external deps required)
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
  console.log("✓ Loaded .env");
} else {
  console.warn("⚠  No .env found at project root — relying on shell environment");
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const QDRANT_URL = process.env.QDRANT_URL?.trim().replace(/\/+$/, "");
const QDRANT_API_KEY = process.env.QDRANT_API_KEY?.trim();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const COLLECTION = process.env.QDRANT_PROPERTIES_COLLECTION?.trim() || "properties";
const EMBEDDING_MODEL = "text-embedding-3-small";
const VECTOR_SIZE = 1536;
const BATCH_SIZE = 10; // OpenAI embedding batch size

if (!QDRANT_URL) throw new Error("QDRANT_URL is not set");
if (!QDRANT_API_KEY) throw new Error("QDRANT_API_KEY is not set");
if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");

const qdrantHeaders = {
  "Content-Type": "application/json",
  "api-key": QDRANT_API_KEY,
};

// ---------------------------------------------------------------------------
// Representative UK property dataset
// Each entry has a `text` field used to generate the embedding.
// The remaining fields become the Qdrant payload (returned to your app).
// ---------------------------------------------------------------------------

const PROPERTIES = [
  // London
  {
    text: "3 bedroom Victorian terraced house in East London E3 needing full gut refurbishment. Poor condition, original features, no central heating.",
    address: "Bow Road, London E3",
    city: "London",
    postcode: "E3",
    propertyType: "terraced",
    bedrooms: 3,
    price: 520000,
    condition: "poor",
    refurbType: "full",
    estimatedRefurbCost: 85000,
    floorAreaM2: 95,
  },
  {
    text: "2 bedroom Victorian flat in South London SE5 needing cosmetic refurbishment, new kitchen and bathroom.",
    address: "Camberwell Grove, London SE5",
    city: "London",
    postcode: "SE5",
    propertyType: "flat",
    bedrooms: 2,
    price: 380000,
    condition: "fair",
    refurbType: "cosmetic",
    estimatedRefurbCost: 30000,
    floorAreaM2: 65,
  },
  {
    text: "4 bedroom semi-detached house in North London N4 requiring full renovation including roof, electrics and extension potential.",
    address: "Finsbury Park, London N4",
    city: "London",
    postcode: "N4",
    propertyType: "semi-detached",
    bedrooms: 4,
    price: 750000,
    condition: "poor",
    refurbType: "full",
    estimatedRefurbCost: 120000,
    floorAreaM2: 140,
  },
  {
    text: "1 bedroom mansion flat in West London W6 needing light cosmetic update, good structural condition.",
    address: "Hammersmith, London W6",
    city: "London",
    postcode: "W6",
    propertyType: "flat",
    bedrooms: 1,
    price: 310000,
    condition: "good",
    refurbType: "light",
    estimatedRefurbCost: 12000,
    floorAreaM2: 48,
  },
  {
    text: "5 bedroom detached house in South West London SW20 requiring full modernisation, large garden, development potential.",
    address: "Wimbledon, London SW20",
    city: "London",
    postcode: "SW20",
    propertyType: "detached",
    bedrooms: 5,
    price: 1100000,
    condition: "poor",
    refurbType: "full",
    estimatedRefurbCost: 200000,
    floorAreaM2: 210,
  },

  // Manchester
  {
    text: "3 bedroom terraced house in Manchester M14 needing full refurbishment. Close to Fallowfield, popular student area.",
    address: "Fallowfield, Manchester M14",
    city: "Manchester",
    postcode: "M14",
    propertyType: "terraced",
    bedrooms: 3,
    price: 185000,
    condition: "poor",
    refurbType: "full",
    estimatedRefurbCost: 45000,
    floorAreaM2: 80,
  },
  {
    text: "2 bedroom flat in Manchester city centre M1 needing cosmetic refurbishment, good investment opportunity.",
    address: "Northern Quarter, Manchester M1",
    city: "Manchester",
    postcode: "M1",
    propertyType: "flat",
    bedrooms: 2,
    price: 160000,
    condition: "fair",
    refurbType: "cosmetic",
    estimatedRefurbCost: 18000,
    floorAreaM2: 58,
  },
  {
    text: "4 bedroom semi-detached house in Didsbury Manchester needing medium refurbishment, new kitchen and bathrooms.",
    address: "Didsbury, Manchester M20",
    city: "Manchester",
    postcode: "M20",
    propertyType: "semi-detached",
    bedrooms: 4,
    price: 340000,
    condition: "fair",
    refurbType: "medium",
    estimatedRefurbCost: 55000,
    floorAreaM2: 120,
  },

  // Birmingham
  {
    text: "3 bedroom terraced house in Birmingham B11 requiring full gut refurbishment. No heating, damp issues, new wiring needed.",
    address: "Sparkhill, Birmingham B11",
    city: "Birmingham",
    postcode: "B11",
    propertyType: "terraced",
    bedrooms: 3,
    price: 140000,
    condition: "poor",
    refurbType: "full",
    estimatedRefurbCost: 50000,
    floorAreaM2: 85,
  },
  {
    text: "5 bedroom detached house in Edgbaston Birmingham needing full renovation. Large plot, great school catchment.",
    address: "Edgbaston, Birmingham B15",
    city: "Birmingham",
    postcode: "B15",
    propertyType: "detached",
    bedrooms: 5,
    price: 480000,
    condition: "poor",
    refurbType: "full",
    estimatedRefurbCost: 130000,
    floorAreaM2: 190,
  },
  {
    text: "2 bedroom flat in Birmingham Jewellery Quarter B1 needing cosmetic update, city centre investment.",
    address: "Jewellery Quarter, Birmingham B1",
    city: "Birmingham",
    postcode: "B1",
    propertyType: "flat",
    bedrooms: 2,
    price: 155000,
    condition: "fair",
    refurbType: "cosmetic",
    estimatedRefurbCost: 15000,
    floorAreaM2: 55,
  },

  // Leeds
  {
    text: "3 bedroom back-to-back terraced house in Leeds LS6 needing full refurbishment. Popular Headingley area near university.",
    address: "Headingley, Leeds LS6",
    city: "Leeds",
    postcode: "LS6",
    propertyType: "terraced",
    bedrooms: 3,
    price: 175000,
    condition: "poor",
    refurbType: "full",
    estimatedRefurbCost: 42000,
    floorAreaM2: 75,
  },
  {
    text: "4 bedroom Victorian semi-detached in Leeds LS17 requiring medium refurbishment, new kitchen, rewire and redecoration.",
    address: "Moortown, Leeds LS17",
    city: "Leeds",
    postcode: "LS17",
    propertyType: "semi-detached",
    bedrooms: 4,
    price: 320000,
    condition: "fair",
    refurbType: "medium",
    estimatedRefurbCost: 60000,
    floorAreaM2: 130,
  },

  // Bristol
  {
    text: "3 bedroom terraced house in Bristol BS3 needing cosmetic refurbishment, popular Bedminster area.",
    address: "Bedminster, Bristol BS3",
    city: "Bristol",
    postcode: "BS3",
    propertyType: "terraced",
    bedrooms: 3,
    price: 290000,
    condition: "fair",
    refurbType: "cosmetic",
    estimatedRefurbCost: 28000,
    floorAreaM2: 88,
  },
  {
    text: "2 bedroom flat in Bristol BS1 city centre needing full refurbishment, original 1960s fit out, high rental demand.",
    address: "Harbourside, Bristol BS1",
    city: "Bristol",
    postcode: "BS1",
    propertyType: "flat",
    bedrooms: 2,
    price: 240000,
    condition: "poor",
    refurbType: "full",
    estimatedRefurbCost: 40000,
    floorAreaM2: 62,
  },
  {
    text: "5 bedroom detached house in Clifton Bristol BS8 needing full renovation. Period property with large garden.",
    address: "Clifton, Bristol BS8",
    city: "Bristol",
    postcode: "BS8",
    propertyType: "detached",
    bedrooms: 5,
    price: 850000,
    condition: "poor",
    refurbType: "full",
    estimatedRefurbCost: 180000,
    floorAreaM2: 220,
  },

  // Sheffield
  {
    text: "3 bedroom end of terrace in Sheffield S7 needing medium refurbishment. Nether Edge area, popular with young professionals.",
    address: "Nether Edge, Sheffield S7",
    city: "Sheffield",
    postcode: "S7",
    propertyType: "terraced",
    bedrooms: 3,
    price: 195000,
    condition: "fair",
    refurbType: "medium",
    estimatedRefurbCost: 38000,
    floorAreaM2: 90,
  },
  {
    text: "4 bedroom detached house in Sheffield S10 Broomhill needing cosmetic update and kitchen replacement.",
    address: "Broomhill, Sheffield S10",
    city: "Sheffield",
    postcode: "S10",
    propertyType: "detached",
    bedrooms: 4,
    price: 380000,
    condition: "good",
    refurbType: "light",
    estimatedRefurbCost: 25000,
    floorAreaM2: 145,
  },

  // Liverpool
  {
    text: "3 bedroom terraced house in Liverpool L15 needing full gut refurbishment. Wavertree area, strong rental market.",
    address: "Wavertree, Liverpool L15",
    city: "Liverpool",
    postcode: "L15",
    propertyType: "terraced",
    bedrooms: 3,
    price: 120000,
    condition: "poor",
    refurbType: "full",
    estimatedRefurbCost: 40000,
    floorAreaM2: 78,
  },
  {
    text: "2 bedroom flat in Liverpool L1 city centre needing cosmetic refurbishment, high tenant demand.",
    address: "Liverpool City Centre L1",
    city: "Liverpool",
    postcode: "L1",
    propertyType: "flat",
    bedrooms: 2,
    price: 105000,
    condition: "fair",
    refurbType: "cosmetic",
    estimatedRefurbCost: 14000,
    floorAreaM2: 52,
  },

  // Edinburgh
  {
    text: "2 bedroom tenement flat in Edinburgh EH6 Leith needing full refurbishment. Original features, great development opportunity.",
    address: "Leith, Edinburgh EH6",
    city: "Edinburgh",
    postcode: "EH6",
    propertyType: "flat",
    bedrooms: 2,
    price: 210000,
    condition: "poor",
    refurbType: "full",
    estimatedRefurbCost: 45000,
    floorAreaM2: 68,
  },
  {
    text: "4 bedroom Victorian townhouse in Edinburgh EH9 Newington needing medium refurbishment.",
    address: "Newington, Edinburgh EH9",
    city: "Edinburgh",
    postcode: "EH9",
    propertyType: "terraced",
    bedrooms: 4,
    price: 520000,
    condition: "fair",
    refurbType: "medium",
    estimatedRefurbCost: 75000,
    floorAreaM2: 155,
  },

  // Nottingham
  {
    text: "3 bedroom terraced house in Nottingham NG7 Lenton needing full refurbishment. Near university, HMO potential.",
    address: "Lenton, Nottingham NG7",
    city: "Nottingham",
    postcode: "NG7",
    propertyType: "terraced",
    bedrooms: 3,
    price: 155000,
    condition: "poor",
    refurbType: "full",
    estimatedRefurbCost: 42000,
    floorAreaM2: 82,
  },

  // Newcastle
  {
    text: "3 bedroom Tyneside flat in Newcastle NE2 Jesmond needing cosmetic refurbishment, popular rental area.",
    address: "Jesmond, Newcastle NE2",
    city: "Newcastle",
    postcode: "NE2",
    propertyType: "flat",
    bedrooms: 3,
    price: 175000,
    condition: "fair",
    refurbType: "cosmetic",
    estimatedRefurbCost: 22000,
    floorAreaM2: 85,
  },

  // Cardiff
  {
    text: "3 bedroom terraced house in Cardiff CF24 Roath needing full refurbishment. Strong buy-to-let demand.",
    address: "Roath, Cardiff CF24",
    city: "Cardiff",
    postcode: "CF24",
    propertyType: "terraced",
    bedrooms: 3,
    price: 160000,
    condition: "poor",
    refurbType: "full",
    estimatedRefurbCost: 38000,
    floorAreaM2: 80,
  },

  // Oxford
  {
    text: "2 bedroom terraced house in Oxford OX4 Cowley needing medium refurbishment. High demand area near BMW plant.",
    address: "Cowley, Oxford OX4",
    city: "Oxford",
    postcode: "OX4",
    propertyType: "terraced",
    bedrooms: 2,
    price: 320000,
    condition: "fair",
    refurbType: "medium",
    estimatedRefurbCost: 35000,
    floorAreaM2: 70,
  },

  // Cambridge
  {
    text: "3 bedroom semi-detached house in Cambridge CB1 needing full refurbishment. Excellent transport links, strong capital growth.",
    address: "Mill Road, Cambridge CB1",
    city: "Cambridge",
    postcode: "CB1",
    propertyType: "semi-detached",
    bedrooms: 3,
    price: 480000,
    condition: "poor",
    refurbType: "full",
    estimatedRefurbCost: 90000,
    floorAreaM2: 100,
  },

  // Brighton
  {
    text: "2 bedroom flat in Brighton BN1 needing cosmetic refurbishment. Sea views, high holiday let potential.",
    address: "Brighton BN1",
    city: "Brighton",
    postcode: "BN1",
    propertyType: "flat",
    bedrooms: 2,
    price: 295000,
    condition: "fair",
    refurbType: "cosmetic",
    estimatedRefurbCost: 20000,
    floorAreaM2: 60,
  },
];

// ---------------------------------------------------------------------------
// Qdrant helpers
// ---------------------------------------------------------------------------

async function qdrantRequest(method, path, body) {
  const response = await fetch(`${QDRANT_URL}${path}`, {
    method,
    headers: qdrantHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Qdrant non-JSON response (${response.status}): ${text}`);
  }

  if (!response.ok) {
    throw new Error(`Qdrant ${method} ${path} failed (${response.status}): ${JSON.stringify(json)}`);
  }

  return json;
}

async function collectionExists() {
  try {
    await qdrantRequest("GET", `/collections/${COLLECTION}`);
    return true;
  } catch {
    return false;
  }
}

async function createCollection() {
  console.log(`Creating collection "${COLLECTION}" (${VECTOR_SIZE} dims, cosine)...`);
  await qdrantRequest("PUT", `/collections/${COLLECTION}`, {
    vectors: {
      size: VECTOR_SIZE,
      distance: "Cosine",
    },
    optimizers_config: {
      default_segment_number: 2,
    },
    replication_factor: 1,
  });
  console.log(`✓ Collection "${COLLECTION}" created`);
}

async function upsertPoints(points) {
  await qdrantRequest("PUT", `/collections/${COLLECTION}/points`, {
    points,
  });
}

// ---------------------------------------------------------------------------
// OpenAI embedding helper
// ---------------------------------------------------------------------------

async function generateEmbeddings(texts) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI embeddings failed (${response.status}): ${err}`);
  }

  const json = await response.json();
  return json.data.map((item) => item.embedding);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nQdrant URL:    ${QDRANT_URL}`);
  console.log(`Collection:    ${COLLECTION}`);
  console.log(`Properties:    ${PROPERTIES.length}`);
  console.log(`OpenAI model:  ${EMBEDDING_MODEL} (${VECTOR_SIZE} dims)\n`);

  // 1. Create collection if needed
  const exists = await collectionExists();
  if (exists) {
    console.log(`✓ Collection "${COLLECTION}" already exists — skipping creation`);
  } else {
    await createCollection();
  }

  // 2. Generate embeddings in batches
  console.log(`\nGenerating embeddings in batches of ${BATCH_SIZE}...`);
  const allEmbeddings = [];

  for (let i = 0; i < PROPERTIES.length; i += BATCH_SIZE) {
    const batch = PROPERTIES.slice(i, i + BATCH_SIZE);
    const texts = batch.map((p) => p.text);
    process.stdout.write(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(PROPERTIES.length / BATCH_SIZE)}... `);
    const embeddings = await generateEmbeddings(texts);
    allEmbeddings.push(...embeddings);
    console.log("done");
  }

  console.log(`✓ Generated ${allEmbeddings.length} embeddings`);

  // 3. Build Qdrant points
  const points = PROPERTIES.map((property, index) => {
    const { text, ...payload } = property;
    return {
      id: index + 1,
      vector: allEmbeddings[index],
      payload,
    };
  });

  // 4. Upsert all points
  console.log(`\nUpserting ${points.length} points into "${COLLECTION}"...`);
  await upsertPoints(points);
  console.log(`✓ Upserted ${points.length} properties\n`);

  // 5. Quick verification
  const info = await qdrantRequest("GET", `/collections/${COLLECTION}`);
  const count = info.result?.points_count ?? "unknown";
  console.log(`✓ Collection now has ${count} points`);
  console.log("\n✅ Seed complete. Run a test search:\n");
  console.log(`  curl -X POST http://localhost:3000/api/v1/search-properties \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"query":"3 bedroom terraced house needing full refurbishment","limit":3}'`);
  console.log();
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err.message);
  process.exit(1);
});
