import { FastifyInstance } from "fastify";
import { eq, and, ilike, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { products, categories, brands } from "../db/schema/catalog.js";
import { inventoryBalances } from "../db/schema/inventory.js";
import { branches } from "../db/schema/locations.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

export async function productRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // List products
  fastify.get("/", { preHandler: [requirePermission("products.view")] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { search, categoryId, status } = request.query as {
      search?: string;
      categoryId?: string;
      status?: string;
    };

    let conditions = [eq(products.tenantId, tenantId)];

    if (status && status !== "all") {
      conditions.push(eq(products.status, status));
    }
    if (categoryId && categoryId !== "all") {
      conditions.push(eq(products.categoryId, categoryId));
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(or(ilike(products.name, q), ilike(products.sku, q), ilike(products.barcode, q))!);
    }

    const rows = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(products.name);

    return { products: rows };
  });

  // Get single product
  fastify.get("/:id", { preHandler: [requirePermission("products.view")] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };

    const rows = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
      .limit(1);

    if (rows.length === 0) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Product not found." } });
    }

    return { product: rows[0] };
  });

  // Create product
  fastify.post("/", { preHandler: [requirePermission("products.create")] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const body = request.body as any;

    if (!body.name || !body.sku || !body.retailPrice) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Name, SKU, and retail price are required." },
      });
    }

    const productId = `prod-${Math.random().toString(36).slice(2, 10)}`;

    const newProd = {
      id: productId,
      tenantId,
      name: body.name,
      sku: body.sku,
      barcode: body.barcode || null,
      categoryId: body.categoryId || "cat-paper",
      brandId: body.brandId || null,
      unitOfMeasure: body.unitOfMeasure || "Pcs",
      cost: Number(body.cost || 0).toFixed(2),
      retailPrice: Number(body.retailPrice).toFixed(2),
      wholesalePrice: Number(body.wholesalePrice || body.retailPrice).toFixed(2),
      reorderLevel: Number(body.reorderLevel || 10),
      taxCategoryId: body.taxCategoryId || "tax-vat-15",
      status: body.status || "active",
      conversionRules: body.conversionRules || [],
    };

    await db.insert(products).values(newProd);

    // Initialize 0 balance records across active branches
    const allBranches = await db.select().from(branches).where(eq(branches.tenantId, tenantId));
    for (const b of allBranches) {
      await db.insert(inventoryBalances).values({
        id: `bal-${productId}-${b.id}`,
        tenantId,
        productId,
        locationId: b.id,
        quantity: "0.00",
        averageCost: newProd.cost,
      }).onConflictDoNothing();
    }

    return reply.status(201).send({ product: newProd });
  });

  // Update product
  fastify.put("/:id", { preHandler: [requirePermission("products.edit")] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const existing = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
      .limit(1);

    if (existing.length === 0) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Product not found." } });
    }

    const patch: any = { updatedAt: new Date() };
    if (body.name !== undefined) patch.name = body.name;
    if (body.sku !== undefined) patch.sku = body.sku;
    if (body.barcode !== undefined) patch.barcode = body.barcode;
    if (body.categoryId !== undefined) patch.categoryId = body.categoryId;
    if (body.cost !== undefined) patch.cost = Number(body.cost).toFixed(2);
    if (body.retailPrice !== undefined) patch.retailPrice = Number(body.retailPrice).toFixed(2);
    if (body.wholesalePrice !== undefined) patch.wholesalePrice = Number(body.wholesalePrice).toFixed(2);
    if (body.reorderLevel !== undefined) patch.reorderLevel = Number(body.reorderLevel);
    if (body.status !== undefined) patch.status = body.status;

    await db.update(products).set(patch).where(and(eq(products.id, id), eq(products.tenantId, tenantId)));

    return { success: true };
  });

  // List categories & brands
  fastify.get("/categories", async (request) => {
    const tenantId = request.user!.tenantId;
    const rows = await db.select().from(categories).where(eq(categories.tenantId, tenantId));
    return { categories: rows };
  });

  fastify.get("/brands", async (request) => {
    const tenantId = request.user!.tenantId;
    const rows = await db.select().from(brands).where(eq(brands.tenantId, tenantId));
    return { brands: rows };
  });
}
