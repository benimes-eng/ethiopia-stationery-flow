import {
  getActiveTenantId,
  db,
  delay,
  persistDatabase,
  recordAudit,
  scoped,
  uid,
} from "@/repositories/mock-repository";
import { parseCSV } from "@/lib/csv";
import type {
  Branch,
  Brand,
  Category,
  Customer,
  ID,
  Product,
  Supplier,
  Tenant,
  UnitOfMeasure,
  User,
} from "@/domain/types";

/** ProductService / TenantService — catalog and master data. */

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  status?: "active" | "archived" | "all";
  page?: number;
  pageSize?: number;
  sort?: { key: keyof Product | "stock"; direction: "asc" | "desc" };
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const catalogService = {
  async listProducts(filters: ProductFilters = {}): Promise<Paged<Product>> {
    const { search = "", categoryId = "all", status = "active", page = 1, pageSize = 15 } = filters;
    let rows = scoped(db().products);
    if (status !== "all") rows = rows.filter((p) => p.status === status);
    if (categoryId !== "all") rows = rows.filter((p) => p.categoryId === categoryId);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q),
      );
    }
    if (filters.sort) {
      const { key, direction } = filters.sort;
      rows = [...rows].sort((a, b) => {
        const av = a[key as keyof Product];
        const bv = b[key as keyof Product];
        const cmp = typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
        return direction === "asc" ? cmp : -cmp;
      });
    }
    const total = rows.length;
    const start = (page - 1) * pageSize;
    return delay({ rows: rows.slice(start, start + pageSize), total, page, pageSize });
  },

  allProducts(): Product[] {
    return scoped(db().products);
  },

  async getProduct(id: ID) {
    return delay(scoped(db().products).find((p) => p.id === id) ?? null);
  },

  findByCode(code: string): Product | undefined {
    const q = code.trim().toLowerCase();
    return scoped(db().products).find(
      (p) => p.status === "active" && (p.barcode === code || p.sku.toLowerCase() === q),
    );
  },

  searchProducts(query: string, limit = 24): Product[] {
    const q = query.trim().toLowerCase();
    const rows = scoped(db().products).filter((p) => p.status === "active");
    if (!q) return rows.slice(0, limit);
    return rows
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q),
      )
      .slice(0, limit);
  },

  async saveProduct(input: Omit<Product, "id" | "tenantId" | "conversionRules"> & { id?: ID }) {
    const data = db();
    if (input.id) {
      const existing = data.products.find((p) => p.id === input.id);
      if (!existing) throw new Error("Product not found.");
      const priceChanged = existing.retailPrice !== input.retailPrice;
      Object.assign(existing, input);
      recordAudit({
        userId: "user-owner",
        action: priceChanged ? "Changed product price" : "Updated product",
        entity: "Product",
        entityId: existing.id,
        branchId: null,
        description: `${existing.name} (${existing.sku}) updated.`,
      });
      return delay(existing);
    }
    const currentTenant = getActiveTenantId();
    const created: Product = {
      ...input,
      conversionRules: [],
      id: uid("prod"),
      tenantId: currentTenant,
    };
    data.products.push(created);
    for (const branch of scoped(data.branches)) {
      data.balances.push({
        id: uid("bal"),
        tenantId: currentTenant,
        productId: created.id,
        locationId: branch.id,
        quantity: 0,
        averageCost: created.cost,
      });
    }
    recordAudit({
      userId: "user-owner",
      action: "Created product",
      entity: "Product",
      entityId: created.id,
      branchId: null,
      description: `${created.name} (${created.sku}) added to the catalog.`,
    });
    return delay(created);
  },

  async archiveProduct(id: ID, reason: string) {
    const product = db().products.find((p) => p.id === id);
    if (!product) throw new Error("Product not found.");
    product.status = "archived";
    recordAudit({
      userId: "user-owner",
      action: "Archived product",
      entity: "Product",
      entityId: id,
      branchId: null,
      description: `${product.name} archived. Reason: ${reason}`,
    });
    return delay(product);
  },

  categories(): Category[] {
    return scoped(db().categories);
  },
  brands(): Brand[] {
    return scoped(db().brands);
  },
  branches(): Branch[] {
    return scoped(db().branches);
  },
  async getBranches() {
    return delay(this.branches());
  },
  async saveBranch(input: Omit<Branch, "id" | "tenantId"> & { id?: ID }) {
    const data = db();
    if (input.id) {
      const existing = data.branches.find((b) => b.id === input.id);
      if (existing) Object.assign(existing, input);
      return delay(existing!);
    }
    const created: Branch = { ...input, id: uid("loc"), tenantId: getActiveTenantId() };
    data.branches.push(created);
    return delay(created);
  },

  /* -------------------------------- Users ------------------------------- */
  users(): User[] {
    return scoped(db().users);
  },
  async getUsers() {
    return delay(this.users());
  },
  async saveUser(input: Omit<User, "id" | "tenantId" | "lastActiveAt"> & { id?: ID }) {
    const data = db();
    if (input.id) {
      const existing = data.users.find((u) => u.id === input.id);
      if (existing) Object.assign(existing, input);
      recordAudit({
        userId: "user-owner",
        action: "Updated user",
        entity: "User",
        entityId: input.id,
        branchId: null,
        description: `${input.name} — role ${input.role}.`,
      });
      return delay(existing!);
    }
    const created: User = {
      ...input,
      id: uid("user"),
      tenantId: getActiveTenantId(),
      lastActiveAt: new Date().toISOString(),
    };
    data.users.push(created);
    return delay(created);
  },

  /* ------------------------------ Customers ----------------------------- */
  customers(): Customer[] {
    return scoped(db().customers);
  },
  async listCustomers(search = "") {
    const q = search.trim().toLowerCase();
    const rows = this.customers().filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.organization ?? "").toLowerCase().includes(q) ||
        c.phone.includes(q),
    );
    return delay(rows);
  },
  async saveCustomer(input: Omit<Customer, "id" | "tenantId" | "createdAt"> & { id?: ID }) {
    const data = db();
    if (input.id) {
      const existing = data.customers.find((c) => c.id === input.id);
      if (existing) Object.assign(existing, input);
      return delay(existing!);
    }
    const currentTenant = getActiveTenantId();
    const created: Customer = {
      ...input,
      id: uid("cus"),
      tenantId: currentTenant,
      createdAt: new Date().toISOString(),
    };
    data.customers.push(created);
    persistDatabase();
    return delay(created);
  },

  /* ------------------------------ Suppliers ----------------------------- */
  suppliers(): Supplier[] {
    return scoped(db().suppliers);
  },
  async listSuppliers(search = "") {
    const q = search.trim().toLowerCase();
    return delay(this.suppliers().filter((s) => !q || s.name.toLowerCase().includes(q)));
  },
  async saveSupplier(input: Omit<Supplier, "id" | "tenantId"> & { id?: ID }) {
    const data = db();
    if (input.id) {
      const existing = data.suppliers.find((s) => s.id === input.id);
      if (existing) Object.assign(existing, input);
      persistDatabase();
      return delay(existing!);
    }
    const created: Supplier = { ...input, id: uid("sup"), tenantId: getActiveTenantId() };
    data.suppliers.push(created);
    persistDatabase();
    return delay(created);
  },

  /* ------------------------------- Tenant ------------------------------- */
  tenant() {
    const current = getActiveTenantId();
    const found = db().tenants.find((t) => t.id === current);
    return found || db().tenants[0]!;
  },
  async updateTenant(patch: Partial<Tenant>) {
    const t = this.tenant();
    Object.assign(t, patch);
    return delay(t);
  },

  /* ----------------------------- CSV import ----------------------------- */
  /**
   * Parses and validates a product CSV.
   * Supports headers:
   * - name / item description / product / title
   * - measure / unit / uom
   * - quantity / qty / stock
   * - cost / cost price / unit cost
   * - price / retail / retail price / unit price
   * - wholesale / wholesale price
   * - category / category name
   * - brand / brand name
   * - sku / code
   * - barcode
   */
  parseProductCsv(text: string) {
    const rawRows = parseCSV(text);
    if (rawRows.length < 2) return [];

    const headers = rawRows[0].map((h) => h.toLowerCase().trim().replace(/[\s_-]+/g, ""));

    const findCol = (aliases: string[]) => {
      for (const alias of aliases) {
        const cleaned = alias.toLowerCase().replace(/[\s_-]+/g, "");
        const idx = headers.findIndex((h) => h === cleaned || h.includes(cleaned));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const nameIdx = findCol(["itemdescription", "description", "name", "product", "item"]);
    const measureIdx = findCol(["measure", "unitofmeasure", "uom", "unit"]);
    const qtyIdx = findCol(["quantity", "qty", "stock", "onhand"]);
    const costIdx = findCol(["costprice", "cost", "unitcost", "buyprice"]);
    const retailIdx = findCol(["unitprice", "retailprice", "retail", "price", "saleprice"]);
    const wholesaleIdx = findCol(["wholesaleprice", "wholesale"]);
    const categoryIdx = findCol(["category", "categoryname", "cat"]);
    const brandIdx = findCol(["brand", "brandname"]);
    const skuIdx = findCol(["sku", "code", "itemcode"]);
    const barcodeIdx = findCol(["barcode", "upc", "ean"]);

    const existingSkus = new Set(scoped(db().products).map((p) => p.sku.toLowerCase()));
    const seenSkusInFile = new Set<string>();

    return rawRows.slice(1).map((row, index) => {
      const getVal = (col: number) => (col >= 0 && col < row.length ? row[col]?.trim() ?? "" : "");

      const name = getVal(nameIdx >= 0 ? nameIdx : 0);
      let measure = getVal(measureIdx);
      const qtyStr = getVal(qtyIdx);
      const costStr = getVal(costIdx);
      const retailStr = getVal(retailIdx);
      const wholesaleStr = getVal(wholesaleIdx);
      const categoryName = getVal(categoryIdx);
      const brandName = getVal(brandIdx);
      let sku = getVal(skuIdx);
      let barcode = getVal(barcodeIdx);

      const errors: string[] = [];

      if (!name) errors.push("Product name / description is required");

      const cleanNum = (str: string) => Number(str.replace(/,/g, "").trim());

      const qty = qtyStr ? cleanNum(qtyStr) : 0;
      if (qtyStr && Number.isNaN(qty)) errors.push("Quantity must be numeric");

      const cost = costStr ? cleanNum(costStr) : 0;
      if (costStr && Number.isNaN(cost)) errors.push("Cost price must be numeric");

      const retailPrice = retailStr ? cleanNum(retailStr) : cost > 0 ? Math.round(cost * 1.3) : 0;
      if (retailStr && Number.isNaN(retailPrice)) errors.push("Unit price must be numeric");

      const wholesalePrice = wholesaleStr
        ? cleanNum(wholesaleStr)
        : retailPrice > 0
          ? Math.round(retailPrice * 0.88)
          : cost;
      if (wholesaleStr && Number.isNaN(wholesalePrice)) errors.push("Wholesale price must be numeric");

      // Normalize UOM
      const validUnits: UnitOfMeasure[] = ["Piece", "Pack", "Box", "Ream", "Carton", "Set"];
      const measureUpper = measure.toUpperCase();
      let matchedUnit: UnitOfMeasure = "Piece";
      if (measureUpper.includes("PKT") || measureUpper.includes("PACK")) matchedUnit = "Pack";
      else if (measureUpper.includes("BOX")) matchedUnit = "Box";
      else if (measureUpper.includes("REEM") || measureUpper.includes("REAM")) matchedUnit = "Ream";
      else if (measureUpper.includes("CARTON")) matchedUnit = "Carton";
      else if (measureUpper.includes("SET")) matchedUnit = "Set";
      else if (measureUpper.includes("PCS") || measureUpper.includes("PIECE")) matchedUnit = "Piece";
      else {
        const found = validUnits.find((u) => u.toLowerCase() === measure.toLowerCase());
        if (found) matchedUnit = found;
      }

      const lineNum = index + 2;
      const skuLower = sku.toLowerCase();
      if (sku) {
        if (existingSkus.has(skuLower) || seenSkusInFile.has(skuLower)) {
          errors.push(`SKU '${sku}' already exists`);
        } else {
          seenSkusInFile.add(skuLower);
        }
      }

      return {
        line: lineNum,
        name,
        measure: matchedUnit,
        quantity: Math.max(0, qty),
        cost: Math.max(0, cost),
        retailPrice: Math.max(0, retailPrice),
        wholesalePrice: Math.max(0, wholesalePrice),
        categoryName: categoryName || "Paper & Envelopes",
        brandName: brandName || "Generic",
        sku,
        barcode,
        errors,
      };
    });
  },

  /** Bulk commits validated rows into the store and seeds warehouse inventory */
  async commitProductCsvImport(
    items: Array<{
      name: string;
      measure: UnitOfMeasure;
      quantity: number;
      cost: number;
      retailPrice: number;
      wholesalePrice: number;
      categoryName: string;
      brandName: string;
      sku?: string;
      barcode?: string;
    }>,
    targetLocationId?: string
  ) {
    const data = db();
    const existingCats = scoped(data.categories);
    const existingBrands = scoped(data.brands);
    const pad = (n: number, w = 4) => String(n).padStart(w, "0");

    const activeTenant = getActiveTenantId();
    let tenantBranches = scoped(data.branches);

    // If no branches exist in this tenant yet, auto-create one
    if (tenantBranches.length === 0) {
      const defBranch: Branch = {
        id: `loc-main-${activeTenant}`,
        tenantId: activeTenant,
        name: "Main Branch",
        code: "HQ-01",
        kind: "branch",
        address: "Main Location",
        phone: "+251 90 000 0000",
        managerName: "Manager",
        status: "active",
      };
      data.branches.push(defBranch);
      tenantBranches = [defBranch];
    }

    // Resolve the actual target branch for inventory balances:
    // 1. Match specified targetLocationId in tenant's branches
    // 2. Or prefer warehouse if one exists in this tenant
    // 3. Or use the first branch in the tenant
    const targetBranch =
      (targetLocationId && tenantBranches.find((b) => b.id === targetLocationId)) ||
      tenantBranches.find((b) => b.kind === "warehouse") ||
      tenantBranches[0]!;
    const actualTargetId = targetBranch.id;

    let nextSkuNum = data.products.length + 1;
    const addedProducts: Product[] = [];

    for (const item of items) {
      // Find or create category
      let cat = existingCats.find(
        (c) => c.name.toLowerCase() === item.categoryName.trim().toLowerCase()
      );
      if (!cat) {
        cat = { id: uid("cat"), tenantId: activeTenant, name: item.categoryName.trim() };
        data.categories.push(cat);
        existingCats.push(cat);
      }

      // Find or create brand
      let brand = existingBrands.find(
        (b) => b.name.toLowerCase() === item.brandName.trim().toLowerCase()
      );
      if (!brand) {
        brand = { id: uid("brand"), tenantId: activeTenant, name: item.brandName.trim() };
        data.brands.push(brand);
        existingBrands.push(brand);
      }

      const sku = item.sku?.trim() || `SKU-${pad(nextSkuNum)}`;
      const barcode = item.barcode?.trim() || `690${pad(nextSkuNum, 9)}`;
      nextSkuNum++;

      const newProd: Product = {
        id: uid("prod"),
        tenantId: activeTenant,
        sku,
        name: item.name.trim(),
        barcode,
        categoryId: cat.id,
        brandId: brand.id,
        description: `Imported ${item.name.trim()}`,
        unitOfMeasure: item.measure,
        purchaseUnit: item.measure,
        salesUnit: item.measure,
        conversionRules: [],
        cost: item.cost,
        retailPrice: item.retailPrice,
        wholesalePrice: item.wholesalePrice,
        reorderLevel: 10,
        taxCategoryId: "tax-vat15",
        supplierId: null,
        status: "active",
      };

      data.products.push(newProd);
      addedProducts.push(newProd);

      // Create balances across all branches of this tenant
      const importQty = Math.max(0, Number(item.quantity) || 0);
      for (const branch of tenantBranches) {
        const isTarget = branch.id === actualTargetId;
        const initialQty = isTarget ? importQty : 0;
        data.balances.push({
          id: uid("bal"),
          tenantId: activeTenant,
          productId: newProd.id,
          locationId: branch.id,
          quantity: initialQty,
          averageCost: item.cost,
        });

        // Record opening stock in ledger so stock history/reports are accurate
        if (isTarget && initialQty > 0) {
          data.ledger.push({
            id: uid("txn"),
            tenantId: activeTenant,
            productId: newProd.id,
            locationId: branch.id,
            type: "OPENING",
            quantity: initialQty,
            unitCost: item.cost,
            reference: "CSV/IMPORT",
            createdAt: new Date().toISOString(),
            note: "Initial stock from CSV import",
          });
        }
      }
    }

    recordAudit({
      userId: "user-owner",
      action: "Imported products CSV",
      entity: "Product",
      entityId: addedProducts[0]?.id ?? "bulk",
      branchId: actualTargetId,
      description: `Bulk imported ${addedProducts.length} product(s) into ${targetBranch.name} via CSV.`,
    });

    persistDatabase();
    return delay({
      importedCount: addedProducts.length,
      products: addedProducts,
      targetBranchName: targetBranch.name,
    });
  },
};

export const PRODUCT_CSV_TEMPLATE =
  `Item Description,Measure,Quantity,Cost Price,Unit Price,Wholesale Price,Category,Brand,SKU,Barcode
A3 POSTA SKY-LINE-BRAND,Piece,1464,12,16,14,Paper & Envelopes,Generic,SKU-SAMPLE-01,690000000001
BIC ROUND STIC BLACK,Piece,610,18,23,20,Writing Instruments,Bic,SKU-SAMPLE-02,690000000002
BOX FILE KENT,Piece,338,215,280,246,Filing & Binders,Generic,SKU-SAMPLE-03,690000000003
CASIO CALCULATOR SMALL SIZE,Piece,36,538,700,616,Office Machines & Electronics,Casio,SKU-SAMPLE-04,690000000004
`;
