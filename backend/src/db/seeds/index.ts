import argon2 from "argon2";
import { db, pool } from "../client.js";
import * as schema from "../schema/index.js";

export async function seedDatabase() {
  console.log("Seeding development database with Ethiopian stationery enterprise data...");

  const tenantId = "tenant-abay";

  // 1. Tenant & Settings
  await db.insert(schema.tenants).values({
    id: tenantId,
    legalName: "Abay Stationery & Office Supplies PLC",
    tradingName: "Abay Stationery",
    tin: "0012345678",
    vatNumber: "15487920",
    vatRegistered: true,
    currency: "ETB",
    phone: "+251 11 551 2345",
    email: "contact@abaystationery.et",
    address: "Bole Sub-City, Woreda 03, House 412, Addis Ababa, Ethiopia",
  }).onConflictDoNothing();

  await db.insert(schema.tenantSettings).values({
    tenantId,
    pricesIncludeTax: false,
    defaultTaxCategoryId: "tax-vat-15",
    invoicePrefix: "INV-",
    receiptPrefix: "REC-",
    quotationPrefix: "QTN-",
    orderPrefix: "SO-",
  }).onConflictDoNothing();

  // 2. Locations (Branches and Warehouses)
  const locBole = { id: "loc-bole", tenantId, name: "Bole Medhanialem Branch", code: "BOL-01", kind: "branch", address: "Cameroon St., Next to Medhanialem Mall", phone: "+251 11 662 1100" };
  const locPiazza = { id: "loc-piazza", tenantId, name: "Piazza Churchill Branch", code: "PIZ-01", kind: "branch", address: "Churchill Ave, Eliana Commercial Center", phone: "+251 11 155 2200" };
  const locKaliti = { id: "loc-kaliti", tenantId, name: "Kaliti Central Warehouse", code: "KAL-WH", kind: "warehouse", address: "Akaki-Kaliti Industrial Zone, Block B", phone: "+251 11 434 3300" };

  await db.insert(schema.branches).values([locBole, locPiazza, locKaliti]).onConflictDoNothing();

  // 3. POS Terminals
  await db.insert(schema.posTerminals).values([
    { id: "term-bole-01", tenantId, branchId: locBole.id, name: "Register 1", code: "REG-01" },
    { id: "term-bole-02", tenantId, branchId: locBole.id, name: "Register 2", code: "REG-02" },
    { id: "term-piazza-01", tenantId, branchId: locPiazza.id, name: "Register 1", code: "REG-01" },
  ]).onConflictDoNothing();

  // 4. Users with Argon2id hashed passwords
  const passwordHash = await argon2.hash("password123");

  const seededUsers = [
    { id: "user-owner", tenantId, name: "Dawit Haile", email: "owner@example.com", phone: "+251 91 123 4567", passwordHash, role: "owner", branchId: locBole.id },
    { id: "user-manager", tenantId, name: "Selamawit Tadesse", email: "manager@example.com", phone: "+251 91 234 5678", passwordHash, role: "manager", branchId: locBole.id },
    { id: "user-cashier", tenantId, name: "Yared Bekele", email: "cashier@example.com", phone: "+251 91 345 6789", passwordHash, role: "cashier", branchId: locBole.id },
    { id: "user-storekeeper", tenantId, name: "Mekonnen Alemu", email: "storekeeper@example.com", phone: "+251 91 456 7890", passwordHash, role: "storekeeper", branchId: locKaliti.id },
    { id: "user-accountant", tenantId, name: "Tigist Girma", email: "accountant@example.com", phone: "+251 91 567 8901", passwordHash, role: "accountant", branchId: locBole.id },
  ];

  await db.insert(schema.users).values(seededUsers).onConflictDoNothing();

  // 5. Tax Categories
  const taxVat15 = { id: "tax-vat-15", tenantId, name: "Standard VAT", code: "VAT-15", rate: "0.1500", isDefault: true };
  const taxTot2 = { id: "tax-tot-2", tenantId, name: "Turnover Tax", code: "TOT-2", rate: "0.0200", isDefault: false };
  const taxExempt = { id: "tax-exempt", tenantId, name: "Exempt", code: "EXEMPT", rate: "0.0000", isDefault: false };

  await db.insert(schema.taxCategories).values([taxVat15, taxTot2, taxExempt]).onConflictDoNothing();

  // 6. Categories & Brands
  const catPaper = { id: "cat-paper", tenantId, name: "Paper & Envelopes", code: "PAP" };
  const catWriting = { id: "cat-writing", tenantId, name: "Writing Instruments", code: "WRT" };
  const catFiling = { id: "cat-filing", tenantId, name: "Filing & Storage", code: "FIL" };
  const catDesk = { id: "cat-desk", tenantId, name: "Desk Accessories", code: "DSK" };

  await db.insert(schema.categories).values([catPaper, catWriting, catFiling, catDesk]).onConflictDoNothing();

  const brandDoubleA = { id: "br-double-a", tenantId, name: "Double A" };
  const brandBic = { id: "br-bic", tenantId, name: "BIC" };
  const brandKangaro = { id: "br-kangaro", tenantId, name: "Kangaro" };

  await db.insert(schema.brands).values([brandDoubleA, brandBic, brandKangaro]).onConflictDoNothing();

  // 7. Products
  const sampleProducts = [
    { id: "prod-paper-a4", tenantId, name: "A4 Copy Paper 80gsm (Box of 5 Reams)", sku: "PAP-A4-80G-BOX", barcode: "6001234567890", categoryId: catPaper.id, brandId: brandDoubleA.id, unitOfMeasure: "Box", cost: "3100.00", retailPrice: "3850.00", wholesalePrice: "3550.00", reorderLevel: 25, taxCategoryId: taxVat15.id },
    { id: "prod-paper-ream", tenantId, name: "A4 Copy Paper 80gsm (Single Ream)", sku: "PAP-A4-80G-RM", barcode: "6001234567891", categoryId: catPaper.id, brandId: brandDoubleA.id, unitOfMeasure: "Ream", cost: "620.00", retailPrice: "790.00", wholesalePrice: "720.00", reorderLevel: 50, taxCategoryId: taxVat15.id },
    { id: "prod-pen-blue", tenantId, name: "Ballpoint Pen Blue 0.7mm (Box of 50)", sku: "PEN-BIC-BL-50", barcode: "6001234567892", categoryId: catWriting.id, brandId: brandBic.id, unitOfMeasure: "Box", cost: "450.00", retailPrice: "650.00", wholesalePrice: "550.00", reorderLevel: 30, taxCategoryId: taxVat15.id },
    { id: "prod-stapler-heavy", tenantId, name: "Heavy Duty Stapler 100 Sheets", sku: "STP-KNG-HD100", barcode: "6001234567893", categoryId: catDesk.id, brandId: brandKangaro.id, unitOfMeasure: "Pcs", cost: "1250.00", retailPrice: "1680.00", wholesalePrice: "1500.00", reorderLevel: 8, taxCategoryId: taxVat15.id },
    { id: "prod-box-file", tenantId, name: "Lever Arch Box File 75mm", sku: "FIL-BOX-75MM", barcode: "6001234567894", categoryId: catFiling.id, unitOfMeasure: "Pcs", cost: "180.00", retailPrice: "260.00", wholesalePrice: "220.00", reorderLevel: 40, taxCategoryId: taxVat15.id },
  ];

  await db.insert(schema.products).values(sampleProducts).onConflictDoNothing();

  // 8. Inventory Balances
  for (const prod of sampleProducts) {
    await db.insert(schema.inventoryBalances).values([
      { id: `bal-${prod.id}-bole`, tenantId, productId: prod.id, locationId: locBole.id, quantity: "80.00", averageCost: prod.cost },
      { id: `bal-${prod.id}-piazza`, tenantId, productId: prod.id, locationId: locPiazza.id, quantity: "45.00", averageCost: prod.cost },
      { id: `bal-${prod.id}-kaliti`, tenantId, productId: prod.id, locationId: locKaliti.id, quantity: "400.00", averageCost: prod.cost },
    ]).onConflictDoNothing();
  }

  // 9. Document Sequences
  const docTypes = ["Invoice", "Receipt", "Quotation", "Order", "PurchaseOrder", "GoodsReceipt", "Return", "Payment", "Transfer", "Count"];
  const prefixes: Record<string, string> = { Invoice: "INV-", Receipt: "REC-", Quotation: "QTN-", Order: "SO-", PurchaseOrder: "PO-", GoodsReceipt: "GRN-", Return: "RET-", Payment: "PAY-", Transfer: "TR-", Count: "CNT-" };

  for (const dt of docTypes) {
    await db.insert(schema.documentSequences).values({
      id: `seq-${dt.toLowerCase()}`,
      tenantId,
      documentType: dt,
      prefix: prefixes[dt] ?? `${dt.slice(0, 3).toUpperCase()}-`,
      currentNumber: 1000,
    }).onConflictDoNothing();
  }

  console.log("Seeding finished successfully.");
}

if (process.argv[1]?.endsWith("index.ts")) {
  seedDatabase()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
