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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
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
      <PopoverContent className="w-[320px] p-0" align="start">
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
                  value={`${option.label} ${option.hint ?? ""}`}
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
  const options = useMemo(
    () =>
      catalogService
        .allProducts()
        .filter((p) => p.status === "active")
        .map((p) => ({
          id: p.id,
          label: `${p.name} — ${p.sku}`,
          hint: formatCurrency(channel === "wholesale" ? p.wholesalePrice : p.retailPrice, {
            symbol: false,
          }),
        })),
    [channel],
  );
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
  const options = useMemo(
    () =>
      catalogService.customers().map((c) => ({
        id: c.id,
        label: c.name,
        hint: c.type,
      })),
    [],
  );
  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Walk-in customer"
      searchPlaceholder="Search customers"
      emptyLabel="No matching customer."
      allowClear
      className={className}
    />
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
  const options = useMemo(
    () => catalogService.suppliers().map((s) => ({ id: s.id, label: s.name, hint: s.phone })),
    [],
  );
  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Select a supplier"
      searchPlaceholder="Search suppliers"
      emptyLabel="No matching supplier."
      className={className}
    />
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
