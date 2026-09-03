import type {
  AuditLog,
  Brand,
  Branch,
  Category,
  Customer,
  Expense,
  GoodsReceipt,
  ID,
  InventoryAdjustment,
  InventoryBalance,
  InventoryCount,
  InventoryTransaction,
  InventoryTransfer,
  Invoice,
  Notification,
  Payment,
  Product,
  PurchaseOrder,
  Quotation,
  Sale,
  SaleReturn,
  SalesOrder,
  ShiftClosure,
  Supplier,
  TaxCategory,
  TaxConfiguration,
  Tenant,
  User,
} from "@/domain/types";

export interface Database {
  tenants: Tenant[];
  users: User[];
  branches: Branch[];
  categories: Category[];
  brands: Brand[];
  products: Product[];
  balances: InventoryBalance[];
  ledger: InventoryTransaction[];
  adjustments: InventoryAdjustment[];
  counts: InventoryCount[];
  transfers: InventoryTransfer[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceipt[];
  customers: Customer[];
  quotations: Quotation[];
  salesOrders: SalesOrder[];
  sales: Sale[];
  returns: SaleReturn[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  shifts: ShiftClosure[];
  taxCategories: TaxCategory[];
  taxConfiguration: TaxConfiguration;
  audit: AuditLog[];
  notifications: Notification[];
  sequences: Record<string, number>;
}

/** Deterministic PRNG so seeded dashboards look the same on every load. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const TENANT: ID = "tenant-abay";

function iso(daysBack: number, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const DEV_PASSWORD = "demo1234";

export function buildDatabase(): Database {
  const rand = rng(20260903);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

  const tenant: Tenant = {
    id: TENANT,
    name: "Abay Stationery & Office Supplies",
    legalName: "Abay Stationery and Office Supplies PLC",
    tin: "0012345678",
    vatRegistered: true,
    vatNumber: "VAT-0012345678",
    phone: "+251 11 552 3344",
    email: "operations@abaystationery.et",
    address: "Bole Road, Addis Ababa, Ethiopia",
    currency: "ETB",
    onboardingComplete: true,
  };

  const branches: Branch[] = [
    {
      id: "loc-main-wh",
      tenantId: TENANT,
      name: "Main Warehouse",
      code: "WH-01",
      kind: "warehouse",
      address: "Kality Industrial Area, Addis Ababa",
      phone: "+251 11 442 1100",
      managerName: "Getachew Alemu",
      status: "active",
    },
    {
      id: "loc-addis",
      tenantId: TENANT,
      name: "Addis Main",
      code: "BR-01",
      kind: "branch",
      address: "Bole Road, Addis Ababa",
      phone: "+251 11 552 3344",
      managerName: "Hanna Tesfaye",
      status: "active",
    },
    {
      id: "loc-hawassa",
      tenantId: TENANT,
      name: "Hawassa Branch",
      code: "BR-02",
      kind: "branch",
      address: "Piazza, Hawassa",
      phone: "+251 46 220 8877",
      managerName: "Yonas Bekele",
      status: "active",
    },
    {
      id: "loc-bahirdar",
      tenantId: TENANT,
      name: "Bahir Dar Branch",
      code: "BR-03",
      kind: "branch",
      address: "Belay Zeleke St, Bahir Dar",
      phone: "+251 58 220 4455",
      managerName: "Marta Assefa",
      status: "active",
    },
    {
      id: "loc-north-wh",
      tenantId: TENANT,
      name: "North Warehouse",
      code: "WH-02",
      kind: "warehouse",
      address: "Gondar Road, Bahir Dar",
      phone: "+251 58 111 2233",
      managerName: "Dawit Girma",
      status: "active",
    },
  ];

  const users: User[] = [
    {
      id: "user-owner",
      tenantId: TENANT,
      name: "Selam Abebe",
      email: "owner@example.com",
      role: "owner",
      branchId: null,
      status: "active",
      lastActiveAt: iso(0, 8, 15),
      devPassword: DEV_PASSWORD,
    },
    {
      id: "user-manager",
      tenantId: TENANT,
      name: "Hanna Tesfaye",
      email: "manager@example.com",
      role: "manager",
      branchId: "loc-addis",
      status: "active",
      lastActiveAt: iso(0, 9, 5),
      devPassword: DEV_PASSWORD,
    },
    {
      id: "user-cashier",
      tenantId: TENANT,
      name: "Bereket Tadesse",
      email: "cashier@example.com",
      role: "cashier",
      branchId: "loc-addis",
      status: "active",
      lastActiveAt: iso(0, 9, 40),
      devPassword: DEV_PASSWORD,
    },
    {
      id: "user-store",
      tenantId: TENANT,
      name: "Getachew Alemu",
      email: "storekeeper@example.com",
      role: "storekeeper",
      branchId: "loc-main-wh",
      status: "active",
      lastActiveAt: iso(1, 16, 20),
      devPassword: DEV_PASSWORD,
    },
    {
      id: "user-accountant",
      tenantId: TENANT,
      name: "Meron Haile",
      email: "accountant@example.com",
      role: "accountant",
      branchId: null,
      status: "active",
      lastActiveAt: iso(1, 11, 0),
      devPassword: DEV_PASSWORD,
    },
    {
      id: "user-cashier-2",
      tenantId: TENANT,
      name: "Kalkidan Mulu",
      email: "cashier.hawassa@example.com",
      role: "cashier",
      branchId: "loc-hawassa",
      status: "inactive",
      lastActiveAt: iso(21, 14, 0),
      devPassword: DEV_PASSWORD,
    },
  ];

  const taxCategories: TaxCategory[] = [
    {
      id: "tax-vat15",
      tenantId: TENANT,
      name: "Standard VAT",
      code: "VAT15",
      rate: 0.15,
      effectiveFrom: "2020-01-01",
      active: true,
    },
    {
      id: "tax-zero",
      tenantId: TENANT,
      name: "Zero rated",
      code: "VAT0",
      rate: 0,
      effectiveFrom: "2020-01-01",
      active: true,
    },
    {
      id: "tax-exempt",
      tenantId: TENANT,
      name: "Exempt",
      code: "EXEMPT",
      rate: 0,
      effectiveFrom: "2020-01-01",
      active: true,
    },
  ];

  const categoryNames = [
    "Paper",
    "Writing Instruments",
    "Filing",
    "Office Machines",
    "Art & Drawing",
    "Adhesives & Cutting",
    "Consumables",
  ];
  const categories: Category[] = categoryNames.map((name, i) => ({
    id: `cat-${i + 1}`,
    tenantId: TENANT,
    name,
  }));

  const brandNames = ["Double A", "Bic", "Faber-Castell", "Deli", "Casio", "HP", "Generic", "Kores"];
  const brands: Brand[] = brandNames.map((name, i) => ({
    id: `brand-${i + 1}`,
    tenantId: TENANT,
    name,
  }));

  const supplierSeed: Array<[string, string, string]> = [
    ["Nile Paper Import PLC", "Merkato, Addis Ababa", "Abraham Kebede"],
    ["Addis Office Supply Trading", "Kazanchis, Addis Ababa", "Fikirte Solomon"],
    ["Ethio Stationery Wholesale", "Merkato, Addis Ababa", "Samuel Girma"],
    ["Blue Nile Trading PLC", "Bahir Dar", "Tigist Mekonnen"],
    ["Rift Valley Distributors", "Hawassa", "Elias Wolde"],
    ["Sheger Print Consumables", "Lideta, Addis Ababa", "Rahel Ayele"],
    ["Highland Books & Paper", "Piassa, Addis Ababa", "Solomon Desta"],
    ["Awash Import & Export", "Adama", "Kidist Legesse"],
    ["Zenith Office Machines", "Bole, Addis Ababa", "Nahom Tariku"],
    ["Saba General Trading", "Mekelle", "Lidya Gebre"],
  ];
  const suppliers: Supplier[] = supplierSeed.map(([name, address, contact], i) => ({
    id: `sup-${i + 1}`,
    tenantId: TENANT,
    name,
    legalName: `${name}`,
    tin: `00${20000000 + i * 137}`,
    vatNumber: i % 3 === 0 ? undefined : `VAT-00${20000000 + i * 137}`,
    contactName: contact,
    phone: `+251 9${int(10, 99)} ${int(100, 999)} ${int(100, 999)}`,
    email: `sales@${name.toLowerCase().replace(/[^a-z]+/g, "")}.et`,
    address,
    notes: i % 4 === 0 ? "Preferred supplier — 30 day terms, delivers to Main Warehouse." : undefined,
    status: "active",
  }));

  const productSeed: Array<{
    name: string;
    cat: number;
    brand: number;
    uom: Product["unitOfMeasure"];
    cost: number;
    retail: number;
    wholesale: number;
  }> = [
    { name: "A4 Copy Paper 80gsm", cat: 0, brand: 0, uom: "Ream", cost: 620, retail: 780, wholesale: 705 },
    { name: "A3 Copy Paper 80gsm", cat: 0, brand: 0, uom: "Ream", cost: 1180, retail: 1450, wholesale: 1320 },
    { name: "Legal Size Paper 70gsm", cat: 0, brand: 6, uom: "Ream", cost: 540, retail: 690, wholesale: 620 },
    { name: "Blue Ballpoint Pen", cat: 1, brand: 1, uom: "Piece", cost: 8, retail: 15, wholesale: 11 },
    { name: "Black Ballpoint Pen", cat: 1, brand: 1, uom: "Piece", cost: 8, retail: 15, wholesale: 11 },
    { name: "Red Ballpoint Pen", cat: 1, brand: 1, uom: "Piece", cost: 8, retail: 15, wholesale: 11 },
    { name: "HB Pencil", cat: 1, brand: 2, uom: "Piece", cost: 6, retail: 12, wholesale: 9 },
    { name: "Eraser", cat: 1, brand: 2, uom: "Piece", cost: 5, retail: 12, wholesale: 8 },
    { name: "Metal Sharpener", cat: 1, brand: 3, uom: "Piece", cost: 9, retail: 20, wholesale: 14 },
    { name: "Exercise Book 48 pages", cat: 0, brand: 6, uom: "Piece", cost: 18, retail: 32, wholesale: 25 },
    { name: "Spiral Notebook A5", cat: 0, brand: 3, uom: "Piece", cost: 55, retail: 95, wholesale: 78 },
    { name: "Stapler Medium", cat: 3, brand: 3, uom: "Piece", cost: 180, retail: 320, wholesale: 260 },
    { name: "Staples No.24/6", cat: 6, brand: 3, uom: "Box", cost: 25, retail: 48, wholesale: 38 },
    { name: "File Folder Plastic", cat: 2, brand: 3, uom: "Piece", cost: 22, retail: 45, wholesale: 34 },
    { name: "Manila Folder", cat: 2, brand: 6, uom: "Pack", cost: 95, retail: 165, wholesale: 132 },
    { name: "Box File 8cm", cat: 2, brand: 3, uom: "Piece", cost: 110, retail: 195, wholesale: 158 },
    { name: "Permanent Marker Black", cat: 1, brand: 7, uom: "Piece", cost: 22, retail: 45, wholesale: 34 },
    { name: "Whiteboard Marker Set", cat: 1, brand: 7, uom: "Set", cost: 145, retail: 260, wholesale: 210 },
    { name: "Glue Stick 21g", cat: 5, brand: 7, uom: "Piece", cost: 28, retail: 55, wholesale: 42 },
    { name: "Office Scissors 8in", cat: 5, brand: 3, uom: "Piece", cost: 85, retail: 165, wholesale: 128 },
    { name: "Plastic Ruler 30cm", cat: 4, brand: 3, uom: "Piece", cost: 9, retail: 22, wholesale: 15 },
    { name: "Scientific Calculator", cat: 3, brand: 4, uom: "Piece", cost: 720, retail: 1150, wholesale: 980 },
    { name: "Toner Cartridge 85A", cat: 6, brand: 5, uom: "Piece", cost: 2400, retail: 3450, wholesale: 3050 },
    { name: "Printer Ink Black", cat: 6, brand: 5, uom: "Piece", cost: 980, retail: 1480, wholesale: 1280 },
    { name: "Colour Pencil Pack 12", cat: 4, brand: 2, uom: "Pack", cost: 130, retail: 240, wholesale: 195 },
    { name: "Drawing Paper A2 Pack", cat: 4, brand: 6, uom: "Pack", cost: 210, retail: 360, wholesale: 300 },
    { name: "Carbon Paper Box", cat: 6, brand: 7, uom: "Box", cost: 160, retail: 275, wholesale: 225 },
    { name: "Desk Organizer", cat: 3, brand: 3, uom: "Piece", cost: 320, retail: 560, wholesale: 460 },
  ];

  const products: Product[] = productSeed.map((p, i) => ({
    id: `prod-${i + 1}`,
    tenantId: TENANT,
    sku: `SKU-${String(1001 + i)}`,
    name: p.name,
    barcode: `600${String(1000000 + i * 7919)}`,
    categoryId: categories[p.cat]!.id,
    brandId: brands[p.brand]!.id,
    description: `${p.name} — stocked for retail counters and wholesale orders.`,
    unitOfMeasure: p.uom,
    purchaseUnit: p.uom === "Piece" ? "Box" : p.uom,
    salesUnit: p.uom,
    conversionRules: [],
    cost: p.cost,
    retailPrice: p.retail,
    wholesalePrice: p.wholesale,
    reorderLevel: p.cost > 500 ? 15 : 60,
    taxCategoryId: i % 11 === 0 ? "tax-zero" : "tax-vat15",
    supplierId: suppliers[i % suppliers.length]!.id,
    status: i === productSeed.length - 1 ? "archived" : "active",
  }));

  const stockLocations = branches.map((b) => b.id);
  const balances: InventoryBalance[] = [];
  const ledger: InventoryTransaction[] = [];
  let ledgerSeq = 0;

  for (const product of products) {
    for (const locationId of stockLocations) {
      const isWarehouse = locationId.includes("wh");
      const base = product.cost > 500 ? int(4, 40) : int(30, 900);
      const quantity = isWarehouse ? base * 3 : base;
      balances.push({
        id: `bal-${product.id}-${locationId}`,
        tenantId: TENANT,
        productId: product.id,
        locationId,
        quantity,
        averageCost: product.cost,
      });
      ledger.push({
        id: `txn-${++ledgerSeq}`,
        tenantId: TENANT,
        productId: product.id,
        locationId,
        type: "PURCHASE",
        quantity,
        unitCost: product.cost,
        reference: "OPENING",
        userId: "user-store",
        createdAt: iso(60, 9, 0),
        note: "Opening stock",
      });
    }
  }

  // A handful of deliberately low / out-of-stock rows for alert realism.
  for (const [i, bal] of balances.entries()) {
    if (i % 17 === 0) bal.quantity = int(0, 8);
  }

  const customerSeed: Array<[string, Customer["type"], string | undefined]> = [
    ["Addis Ababa Science Academy", "School", "Addis Ababa Science Academy"],
    ["Bright Future School", "School", "Bright Future School PLC"],
    ["Ethio Telecom Procurement", "Business", "Ethio Telecom"],
    ["Save the Children Ethiopia", "NGO", "Save the Children"],
    ["Ministry of Education", "Government", "Ministry of Education"],
    ["Kebede Trading PLC", "Business", "Kebede Trading PLC"],
    ["Hawassa University", "Government", "Hawassa University"],
    ["Zenith Consulting", "Business", "Zenith Consulting PLC"],
    ["Selamawit Girma", "Individual", undefined],
    ["Abebe Bekele", "Individual", undefined],
    ["Tsion Haile", "Individual", undefined],
    ["Nardos Print House", "Business", "Nardos Print House"],
    ["Lideta Secondary School", "School", "Lideta Secondary School"],
    ["Concern Worldwide", "NGO", "Concern Worldwide"],
    ["Bahir Dar City Administration", "Government", "Bahir Dar City Administration"],
    ["Yohannes Tesfa", "Individual", undefined],
    ["Blue Sky Travel", "Business", "Blue Sky Travel PLC"],
    ["Hope Enterprises", "Other Organization", "Hope Enterprises"],
    ["Meskerem Alemu", "Individual", undefined],
    ["Rift Valley Academy", "School", "Rift Valley Academy"],
  ];
  const customers: Customer[] = customerSeed.map(([name, type, org], i) => ({
    id: `cus-${i + 1}`,
    tenantId: TENANT,
    name,
    type,
    organization: org,
    tin: type === "Individual" ? undefined : `00${30000000 + i * 211}`,
    vatNumber: type === "Individual" ? undefined : `VAT-00${30000000 + i * 211}`,
    phone: `+251 9${int(10, 99)} ${int(100, 999)} ${int(100, 999)}`,
    email: type === "Individual" ? undefined : `procurement${i + 1}@example.et`,
    address: pick(["Addis Ababa", "Hawassa", "Bahir Dar", "Adama", "Mekelle"]),
    createdAt: iso(int(30, 300)),
  }));

  /* ------------------------------ Transactions ---------------------------- */

  const sales: Sale[] = [];
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  const activeProducts = products.filter((p) => p.status === "active");
  const retailBranches = ["loc-addis", "loc-hawassa", "loc-bahirdar"];

  for (let i = 0; i < 34; i++) {
    const daysBack = i < 8 ? 0 : int(1, 45);
    const branchId = pick(retailBranches);
    const lineCount = int(1, 5);
    const lines = Array.from({ length: lineCount }, () => {
      const product = pick(activeProducts);
      return {
        productId: product.id,
        description: product.name,
        quantity: int(1, 12),
        unitPrice: product.retailPrice,
        discount: rand() > 0.8 ? int(5, 60) : 0,
        taxCategoryId: product.taxCategoryId,
      };
    });
    const saleId = `sale-${i + 1}`;
    const invoiceId = `inv-r-${i + 1}`;
    const cashierId = branchId === "loc-hawassa" ? "user-cashier-2" : "user-cashier";
    sales.push({
      id: saleId,
      tenantId: TENANT,
      number: `S-${String(10001 + i)}`,
      branchId,
      registerId: "REG-01",
      customerId: rand() > 0.7 ? pick(customers).id : null,
      channel: "retail",
      lines,
      createdAt: iso(daysBack, int(9, 18), int(0, 59)),
      cashierId,
      invoiceId,
      status: "completed",
    });
    invoices.push({
      id: invoiceId,
      tenantId: TENANT,
      number: `INV-${String(20001 + i)}`,
      customerId: sales[i]!.customerId,
      branchId,
      date: sales[i]!.createdAt,
      status: "Paid",
      lines,
      saleId,
      createdBy: cashierId,
    });
    const total = lines.reduce(
      (sum, l) => sum + (l.quantity * l.unitPrice - l.discount) * (l.taxCategoryId === "tax-vat15" ? 1.15 : 1),
      0,
    );
    const method: Payment["method"] = rand() > 0.72 ? "Bank" : "Cash";
    payments.push({
      id: `pay-r-${i + 1}`,
      tenantId: TENANT,
      number: `PMT-${String(30001 + i)}`,
      invoiceId,
      saleId,
      branchId,
      amount: Math.round(total * 100) / 100,
      method,
      bank: method === "Bank" ? pick(["Commercial Bank of Ethiopia", "Awash Bank", "Dashen Bank"]) : undefined,
      reference: method === "Bank" ? `TT${int(100000, 999999)}` : undefined,
      receivedBy: cashierId,
      date: sales[i]!.createdAt,
    });
    for (const line of lines) {
      ledger.push({
        id: `txn-${++ledgerSeq}`,
        tenantId: TENANT,
        productId: line.productId,
        locationId: branchId,
        type: "SALE",
        quantity: -line.quantity,
        unitCost: products.find((p) => p.id === line.productId)!.cost,
        reference: sales[i]!.number,
        userId: cashierId,
        createdAt: sales[i]!.createdAt,
      });
    }
  }

  /* Wholesale documents */
  const quotations: Quotation[] = [];
  const salesOrders: SalesOrder[] = [];
  const quotationStatuses: Quotation["status"][] = [
    "Draft",
    "Sent",
    "Sent",
    "Accepted",
    "Accepted",
    "Rejected",
    "Expired",
    "Converted",
    "Sent",
    "Accepted",
  ];
  for (let i = 0; i < 10; i++) {
    const customer = customers[i]!;
    const lines = Array.from({ length: int(2, 6) }, () => {
      const product = pick(activeProducts);
      return {
        productId: product.id,
        description: product.name,
        quantity: int(10, 200),
        unitPrice: product.wholesalePrice,
        discount: 0,
        taxCategoryId: product.taxCategoryId,
      };
    });
    const date = iso(int(2, 40));
    const status = quotationStatuses[i]!;
    const id = `quo-${i + 1}`;
    quotations.push({
      id,
      tenantId: TENANT,
      number: `QT-${String(40001 + i)}`,
      customerId: customer.id,
      branchId: "loc-addis",
      date,
      validUntil: iso(int(-20, -1)),
      status,
      lines,
      terms: "Valid for 15 days. Delivery from Main Warehouse within 3 working days.",
      createdBy: "user-manager",
    });
    if (status === "Converted" || status === "Accepted") {
      const soId = `so-${i + 1}`;
      salesOrders.push({
        id: soId,
        tenantId: TENANT,
        number: `SO-${String(50001 + i)}`,
        customerId: customer.id,
        branchId: "loc-addis",
        date,
        status: status === "Converted" ? "Fulfilled" : "Confirmed",
        lines,
        quotationId: id,
        createdBy: "user-manager",
      });
      if (status === "Converted") {
        quotations[i]!.salesOrderId = soId;
        const invId = `inv-w-${i + 1}`;
        salesOrders[salesOrders.length - 1]!.invoiceId = invId;
        invoices.push({
          id: invId,
          tenantId: TENANT,
          number: `INV-${String(21001 + i)}`,
          customerId: customer.id,
          branchId: "loc-addis",
          date,
          status: "Partially Paid",
          lines,
          salesOrderId: soId,
          createdBy: "user-accountant",
        });
      }
    }
  }

  /* Purchase orders */
  const purchaseOrders: PurchaseOrder[] = [];
  const goodsReceipts: GoodsReceipt[] = [];
  const poStatuses: PurchaseOrder["status"][] = [
    "Draft",
    "Pending Approval",
    "Pending Approval",
    "Approved",
    "Approved",
    "Partially Received",
    "Received",
    "Received",
    "Cancelled",
    "Approved",
  ];
  for (let i = 0; i < 10; i++) {
    const items = Array.from({ length: int(2, 5) }, () => {
      const product = pick(activeProducts);
      const quantity = int(20, 400);
      return { productId: product.id, quantity, unitCost: product.cost, receivedQty: 0 };
    });
    const status = poStatuses[i]!;
    if (status === "Received") items.forEach((it) => (it.receivedQty = it.quantity));
    if (status === "Partially Received")
      items.forEach((it, idx) => (it.receivedQty = idx === 0 ? Math.floor(it.quantity * 0.6) : 0));
    const id = `po-${i + 1}`;
    purchaseOrders.push({
      id,
      tenantId: TENANT,
      number: `PO-${String(60001 + i)}`,
      supplierId: suppliers[i]!.id,
      locationId: i % 3 === 0 ? "loc-main-wh" : pick(retailBranches),
      date: iso(int(3, 50)),
      expectedDate: iso(int(-10, 2)),
      status,
      items,
      createdBy: "user-store",
    });
    if (status === "Received" || status === "Partially Received") {
      goodsReceipts.push({
        id: `grn-${i + 1}`,
        tenantId: TENANT,
        number: `GRN-${String(70001 + i)}`,
        purchaseOrderId: id,
        locationId: purchaseOrders[i]!.locationId,
        date: iso(int(1, 20)),
        items: items
          .filter((it) => it.receivedQty > 0)
          .map((it) => ({ productId: it.productId, quantity: it.receivedQty, unitCost: it.unitCost })),
        receivedBy: "user-store",
      });
    }
  }

  /* Transfers, counts, adjustments */
  const transfers: InventoryTransfer[] = (
    ["Requested", "Approved", "In Transit", "Received", "Draft", "Cancelled"] as const
  ).map((status, i) => ({
    id: `trf-${i + 1}`,
    tenantId: TENANT,
    reference: `TRF-${String(80001 + i)}`,
    fromLocationId: "loc-main-wh",
    toLocationId: pick(retailBranches),
    status,
    lines: Array.from({ length: int(1, 4) }, () => ({
      productId: pick(activeProducts).id,
      quantity: int(10, 120),
    })),
    createdAt: iso(int(1, 25)),
    createdBy: "user-store",
  }));

  const counts: InventoryCount[] = (["Counting", "Pending Approval", "Approved"] as const).map(
    (status, i) => ({
      id: `cnt-${i + 1}`,
      tenantId: TENANT,
      reference: `SC-${String(90001 + i)}`,
      locationId: i === 0 ? "loc-addis" : "loc-main-wh",
      status,
      lines: activeProducts.slice(i * 5, i * 5 + 8).map((p) => {
        const systemQty =
          balances.find((b) => b.productId === p.id && b.locationId === (i === 0 ? "loc-addis" : "loc-main-wh"))
            ?.quantity ?? 0;
        return {
          productId: p.id,
          systemQty,
          physicalQty: status === "Counting" ? null : Math.max(0, systemQty - int(0, 9)),
        };
      }),
      createdAt: iso(int(1, 14)),
      createdBy: "user-store",
    }),
  );

  const adjustments: InventoryAdjustment[] = Array.from({ length: 8 }, (_, i) => ({
    id: `adj-${i + 1}`,
    tenantId: TENANT,
    productId: pick(activeProducts).id,
    locationId: pick(stockLocations),
    type: rand() > 0.6 ? "increase" : "decrease",
    quantity: int(1, 25),
    reason: pick(["Damage", "Loss", "Found stock", "Counting correction", "Other"]),
    notes: "Recorded during weekly reconciliation.",
    userId: "user-store",
    createdAt: iso(int(1, 30)),
  }));

  const returns: SaleReturn[] = Array.from({ length: 5 }, (_, i) => {
    const sale = sales[i * 3]!;
    return {
      id: `ret-${i + 1}`,
      tenantId: TENANT,
      number: `RTN-${String(95001 + i)}`,
      saleId: sale.id,
      branchId: sale.branchId,
      lines: [
        {
          productId: sale.lines[0]!.productId,
          quantity: 1,
          unitPrice: sale.lines[0]!.unitPrice,
        },
      ],
      reason: pick(["Customer return", "Damaged", "Wrong product", "Duplicate", "Other"]),
      createdAt: iso(int(1, 20)),
      createdBy: "user-cashier",
    };
  });

  const expenses: Expense[] = Array.from({ length: 14 }, (_, i) => ({
    id: `exp-${i + 1}`,
    tenantId: TENANT,
    date: iso(int(1, 45)),
    category: pick(["Rent", "Utilities", "Transport", "Supplies", "Maintenance", "Salary", "Other"]),
    amount: int(500, 45000),
    method: rand() > 0.5 ? "Cash" : "Bank",
    branchId: pick(stockLocations),
    description: "Operational expense recorded by branch administration.",
    recordedBy: "user-accountant",
  }));

  const shifts: ShiftClosure[] = Array.from({ length: 4 }, (_, i) => ({
    id: `shift-${i + 1}`,
    tenantId: TENANT,
    branchId: "loc-addis",
    registerId: "REG-01",
    cashierId: "user-cashier",
    openingBalance: 2000,
    cashSales: int(30000, 70000),
    cashReturns: int(0, 1200),
    actualCash: 0,
    closedAt: iso(i + 1, 19, 30),
    reviewedBy: "user-manager",
  })).map((s) => ({ ...s, actualCash: s.openingBalance + s.cashSales - s.cashReturns - int(0, 120) }));

  const audit: AuditLog[] = [
    ["Changed product price", "Product", "prod-1", "Retail price updated from ETB 760.00 to ETB 780.00"],
    ["Adjusted inventory", "InventoryAdjustment", "adj-1", "Decrease of 6 units — Damage"],
    ["Cancelled invoice", "Invoice", "inv-r-4", "Cancelled with reason: duplicate issue"],
    ["Created purchase order", "PurchaseOrder", "po-3", "PO-60003 for Ethio Stationery Wholesale"],
    ["Changed user permission", "Role", "cashier", "Removed sales.discount from Cashier"],
    ["Approved stock count", "InventoryCount", "cnt-3", "Variance -21 units approved"],
    ["Received goods", "GoodsReceipt", "grn-7", "GRN-70007 received into Main Warehouse"],
  ].map(([action, entity, entityId, description], i) => ({
    id: `aud-${i + 1}`,
    tenantId: TENANT,
    userId: pick(users).id,
    action: action!,
    entity: entity!,
    entityId: entityId!,
    branchId: "loc-addis",
    description: description!,
    createdAt: iso(int(0, 12), int(8, 18), int(0, 59)),
  }));

  const notifications: Notification[] = [
    {
      kind: "low_stock",
      title: "23 products below reorder level",
      body: "Addis Main and Hawassa Branch need replenishment from Main Warehouse.",
    },
    {
      kind: "quotation",
      title: "Quotation QT-40004 accepted",
      body: "Save the Children Ethiopia accepted the quotation. Convert it to a sales order.",
    },
    {
      kind: "approval",
      title: "Purchase order PO-60002 awaiting approval",
      body: "Addis Office Supply Trading — ETB 184,500.00",
    },
    {
      kind: "transfer",
      title: "Transfer TRF-80003 in transit",
      body: "Main Warehouse → Hawassa Branch. Awaiting receipt confirmation.",
    },
    {
      kind: "invoice",
      title: "Invoice INV-21008 partially paid",
      body: "Remaining balance recorded against bank payment reference TT884120.",
    },
    {
      kind: "system",
      title: "Fiscal integration not configured",
      body: "Ethiopian e-invoicing adapter is available for a future release.",
    },
  ].map((n, i) => ({
    id: `ntf-${i + 1}`,
    tenantId: TENANT,
    ...n,
    createdAt: iso(0, 8 + i, int(0, 59)),
    read: i > 3,
  }));

  return {
    tenants: [tenant],
    users,
    branches,
    categories,
    brands,
    products,
    balances,
    ledger,
    adjustments,
    counts,
    transfers,
    suppliers,
    purchaseOrders,
    goodsReceipts,
    customers,
    quotations,
    salesOrders,
    sales,
    returns,
    invoices,
    payments,
    expenses,
    shifts,
    taxCategories,
    taxConfiguration: {
      pricesIncludeTax: false,
      defaultTaxCategoryId: "tax-vat15",
      fiscalAdapter: "none",
      fiscalStatus: "not_configured",
    },
    audit,
    notifications,
    sequences: {
      sale: 10035,
      invoice: 21100,
      payment: 30100,
      quotation: 40011,
      salesOrder: 50011,
      purchaseOrder: 60011,
      receipt: 70011,
      transfer: 80007,
      count: 90004,
      return: 95006,
    },
  };
}

export const SEED_TENANT_ID = TENANT;
