import { create } from "zustand";
import type { DocumentLine, ID, Product } from "@/domain/types";

export interface CartLine extends DocumentLine {
  name: string;
  sku: string;
  maxPrice: number;
}

interface PosState {
  lines: CartLine[];
  customerId: ID | null;
  channel: "retail" | "wholesale";
  registerId: string;
  addProduct: (product: Product, quantity?: number) => void;
  setQuantity: (productId: ID, quantity: number) => void;
  setDiscount: (productId: ID, discount: number) => void;
  setUnitPrice: (productId: ID, price: number) => void;
  removeLine: (productId: ID) => void;
  removeLast: () => void;
  setCustomer: (customerId: ID | null) => void;
  setChannel: (channel: "retail" | "wholesale") => void;
  loadLines: (lines: CartLine[], customerId: ID | null) => void;
  clear: () => void;
}

export const usePosStore = create<PosState>((set) => ({
  lines: [],
  customerId: null,
  channel: "retail",
  registerId: "REG-01",
  addProduct: (product, quantity = 1) =>
    set((state) => {
      const price = state.channel === "wholesale" ? product.wholesalePrice : product.retailPrice;
      const existing = state.lines.find((l) => l.productId === product.id);
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.productId === product.id ? { ...l, quantity: l.quantity + quantity } : l,
          ),
        };
      }
      return {
        lines: [
          ...state.lines,
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            description: product.name,
            quantity,
            unitPrice: price,
            maxPrice: price,
            discount: 0,
            taxCategoryId: product.taxCategoryId,
          },
        ],
      };
    }),
  setQuantity: (productId, quantity) =>
    set((state) => ({
      lines: state.lines
        .map((l) => (l.productId === productId ? { ...l, quantity: Math.max(0, quantity) } : l))
        .filter((l) => l.quantity > 0),
    })),
  setDiscount: (productId, discount) =>
    set((state) => ({
      lines: state.lines.map((l) =>
        l.productId === productId ? { ...l, discount: Math.max(0, discount) } : l,
      ),
    })),
  setUnitPrice: (productId, price) =>
    set((state) => ({
      lines: state.lines.map((l) =>
        l.productId === productId ? { ...l, unitPrice: Math.max(0, price) } : l,
      ),
    })),
  removeLine: (productId) =>
    set((state) => ({ lines: state.lines.filter((l) => l.productId !== productId) })),
  removeLast: () => set((state) => ({ lines: state.lines.slice(0, -1) })),
  setCustomer: (customerId) => set({ customerId }),
  setChannel: (channel) => set({ channel }),
  loadLines: (lines, customerId) => set({ lines, customerId }),
  clear: () => set({ lines: [], customerId: null }),
}));
