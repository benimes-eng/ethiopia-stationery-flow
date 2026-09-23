import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { catalogService } from "@/services/catalog.service";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ID } from "@/domain/types";

function Combobox({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  className,
  allowClear,
}: {
  value: ID | null;
  onChange: (value: ID | null) => void;
  options: Array<{ id: ID; label: string; hint?: string }>;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  className?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <Popover modal={true} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 z-[70]" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {allowClear ? (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <span className="text-muted-foreground">Clear selection</span>
                </CommandItem>
              ) : null}
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.label} ${option.hint ?? ""} ${option.id}`}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === option.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.hint ? (
                    <span className="num ml-2 text-xs text-muted-foreground">{option.hint}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ProductSelector({
  value,
  onChange,
  channel = "retail",
  className,
}: {
  value: ID | null;
  onChange: (value: ID | null) => void;
  channel?: "retail" | "wholesale";
  className?: string;
}) {
  const products = catalogService
    .allProducts()
    .filter((p) => p.status === "active");

  const options = products.map((p) => ({
    id: p.id,
    label: `${p.name} — ${p.sku}`,
    hint: formatCurrency(channel === "wholesale" ? p.wholesalePrice : p.retailPrice, {
      symbol: false,
    }),
  }));

  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Select a product"
      searchPlaceholder="Search by name, SKU or barcode"
      emptyLabel="No matching product."
      className={className}
    />
  );
}

export function CustomerSelector({
  value,
  onChange,
  className,
}: {
  value: ID | null;
  onChange: (value: ID | null) => void;
  className?: string;
}) {
  const customers = catalogService.customers();
  const selected = customers.find((c) => c.id === value);

  return (
    <Select
      value={value ?? "__walkin__"}
      onValueChange={(val) => {
        onChange(val === "__walkin__" ? null : val);
      }}
    >
      <SelectTrigger className={cn("w-full justify-between font-normal", className)}>
        <SelectValue placeholder="Walk-in customer">
          {selected ? (
            <span>
              {selected.name}
              {selected.phone ? (
                <span className="text-xs text-muted-foreground ml-1.5">({selected.phone})</span>
              ) : null}
            </span>
          ) : (
            <span className="text-muted-foreground">Walk-in customer</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px] z-[70]">
        <SelectItem value="__walkin__">
          <span className="text-muted-foreground">Walk-in customer</span>
        </SelectItem>
        {customers.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="font-medium">{c.name}</span>
            {c.organization ? (
              <span className="text-xs text-muted-foreground ml-1.5">({c.organization})</span>
            ) : null}
            {c.phone ? (
              <span className="text-xs text-muted-foreground ml-1.5">· {c.phone}</span>
            ) : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SupplierSelector({
  value,
  onChange,
  className,
}: {
  value: ID | null;
  onChange: (value: ID | null) => void;
  className?: string;
}) {
  const suppliers = catalogService.suppliers();
  const selected = suppliers.find((s) => s.id === value);

  return (
    <Select
      value={value ?? "__none__"}
      onValueChange={(val) => {
        onChange(val === "__none__" ? null : val);
      }}
    >
      <SelectTrigger className={cn("w-full justify-between font-normal", className)}>
        <SelectValue placeholder="Select a supplier">
          {selected ? (
            <span>
              {selected.name}
              {selected.phone ? (
                <span className="text-xs text-muted-foreground ml-1.5">({selected.phone})</span>
              ) : null}
            </span>
          ) : (
            <span className="text-muted-foreground">Select a supplier</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px] z-[70]">
        {suppliers.length === 0 ? (
          <SelectItem value="__none__" disabled>
            No suppliers available
          </SelectItem>
        ) : null}
        {suppliers.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <span className="font-medium">{s.name}</span>
            {s.phone ? (
              <span className="text-xs text-muted-foreground ml-1.5">· {s.phone}</span>
            ) : null}
            {s.contactPerson ? (
              <span className="text-xs text-muted-foreground ml-1.5">({s.contactPerson})</span>
            ) : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LocationSelect({
  value,
  onChange,
  includeAll,
  kind,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
  kind?: "branch" | "warehouse";
  className?: string;
}) {
  const locations = catalogService
    .branches()
    .filter((b) => b.status === "active" && (!kind || b.kind === kind));
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("w-full sm:w-[220px]", className)}>
        <SelectValue placeholder="Select location" />
      </SelectTrigger>
      <SelectContent>
        {includeAll ? <SelectItem value="all">All locations</SelectItem> : null}
        {locations.map((location) => (
          <SelectItem key={location.id} value={location.id}>
            {location.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
