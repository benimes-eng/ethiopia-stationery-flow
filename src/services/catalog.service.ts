import {
  ACTIVE_TENANT_ID,
  db,
  delay,
  recordAudit,
  scoped,
  uid,
} from "@/repositories/mock-repository";
import type {
  Branch,
  Brand,
  Category,
  Customer,
  ID,
  Product,
  Supplier,
  Tenant,
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
    const created: Product = {
      ...input,
      conversionRules: [],
      id: uid("prod"),
      tenantId: ACTIVE_TENANT_ID,
    };
    data.products.push(created);
    for (const branch of scoped(data.branches)) {
      data.balances.push({
        id: uid("bal"),
        tenantId: ACTIVE_TENANT_ID,
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
    const created: Branch = { ...input, id: uid("loc"), tenantId: ACTIVE_TENANT_ID };
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
      tenantId: ACTIVE_TENANT_ID,
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
    const created: Customer = {
      ...input,
      id: uid("cus"),
      tenantId: ACTIVE_TENANT_ID,
      createdAt: new Date().toISOString(),
    };
    data.customers.push(created);
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
      return delay(existing!);
    }
    const created: Supplier = { ...input, id: uid("sup"), tenantId: ACTIVE_TENANT_ID };
    data.suppliers.push(created);
    return delay(created);
  },

  /* ------------------------------- Tenant ------------------------------- */
  tenant() {
    return db().tenants[0]!;
  },
  async updateTenant(patch: Partial<Tenant>) {
    Object.assign(db().tenants[0]!, patch);
    return delay(db().tenants[0]!);
  },

  /* ----------------------------- CSV import ----------------------------- */
  /** Parses and validates a product CSV. Persisting is intentionally opt-in. */
  parseProductCsv(text: string) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    const [, ...rows] = lines;
    return rows.map((row, index) => {
      const [name, sku, barcode, cost, retail, wholesale] = row.split(",").map((c) => c?.trim());
      const errors: string[] = [];
      if (!name) errors.push("Name is required");
      if (!sku) errors.push("SKU is required");
      if (sku && scoped(db().products).some((p) => p.sku === sku)) errors.push("SKU already exists");
      if (Number.isNaN(Number(cost))) errors.push("Cost must be numeric");
      if (Number.isNaN(Number(retail))) errors.push("Retail price must be numeric");
      return {
        line: index + 2,
        name: name ?? "",
        sku: sku ?? "",
        barcode: barcode ?? "",
        cost: Number(cost ?? 0),
        retailPrice: Number(retail ?? 0),
        wholesalePrice: Number(wholesale ?? retail ?? 0),
        errors,
      };
    });
  },
};

export const PRODUCT_CSV_TEMPLATE =
  "name,sku,barcode,cost,retail_price,wholesale_price\nA4 Copy Paper 80gsm,SKU-2001,6001234567890,620,780,705\n";
