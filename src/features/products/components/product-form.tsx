"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { saveProduct, deleteProduct } from "../actions";
import { Button, Field, Input, Select } from "@/components/ui";
import { Toggle } from "@/features/ai-config/components/persona-form";

export interface ProductFormValues {
  id?: string;
  name: string;
  sku: string;
  categoryId: string;
  description: string;
  price: string;
  salePrice: string;
  stock: string;
  style: string;
  colors: string;
  materials: string;
  widthCm: string;
  depthCm: string;
  heightCm: string;
  seats: string;
  deliveryDays: string;
  warrantyMonths: string;
  isActive: boolean;
}

export function ProductForm({
  initial,
  categories,
}: {
  initial: ProductFormValues;
  categories: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(saveProduct, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Field label="Product name">
            <Input name="name" defaultValue={initial.name} required placeholder="Oslo Corner Sofa" />
          </Field>
        </div>
        <Field label="SKU (optional)">
          <Input name="sku" defaultValue={initial.sku} placeholder="MAM-OSLO01" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Category">
          <Select name="categoryId" defaultValue={initial.categoryId}>
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="…or create a new category">
          <Input name="newCategory" placeholder="e.g. Outdoor" />
        </Field>
      </div>

      <Field label="Description (the AI uses this when recommending)">
        <textarea
          name="description"
          rows={3}
          defaultValue={initial.description}
          placeholder="Scandinavian corner sofa in soft grey fabric with oak legs…"
          className="w-full px-3.5 py-2.5 bg-card border border-line rounded-[10px] text-[13.5px] text-ink placeholder:text-ink-soft outline-none focus:border-accent-line focus:ring-2 focus:ring-accent-soft transition resize-y"
        />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Price (€)">
          <Input name="price" type="number" step="0.01" min="0" defaultValue={initial.price} required />
        </Field>
        <Field label="Sale price (optional)">
          <Input name="salePrice" type="number" step="0.01" min="0" defaultValue={initial.salePrice} />
        </Field>
        <Field label="Stock">
          <Input name="stock" type="number" min="0" defaultValue={initial.stock} required />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Colors (comma-separated)">
          <Input name="colors" defaultValue={initial.colors} placeholder="grey, beige" />
        </Field>
        <Field label="Materials (comma-separated)">
          <Input name="materials" defaultValue={initial.materials} placeholder="fabric, oak" />
        </Field>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Field label="Width (cm)">
          <Input name="widthCm" type="number" min="0" defaultValue={initial.widthCm} />
        </Field>
        <Field label="Depth (cm)">
          <Input name="depthCm" type="number" min="0" defaultValue={initial.depthCm} />
        </Field>
        <Field label="Height (cm)">
          <Input name="heightCm" type="number" min="0" defaultValue={initial.heightCm} />
        </Field>
        <Field label="Seats">
          <Input name="seats" type="number" min="0" defaultValue={initial.seats} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Style">
          <Input name="style" defaultValue={initial.style} placeholder="modern, scandinavian…" />
        </Field>
        <Field label="Delivery (days)">
          <Input name="deliveryDays" type="number" min="0" defaultValue={initial.deliveryDays} />
        </Field>
        <Field label="Warranty (months)">
          <Input name="warrantyMonths" type="number" min="0" defaultValue={initial.warrantyMonths} />
        </Field>
      </div>

      <Toggle
        name="isActive"
        label="Visible to the AI"
        hint="Hidden products are never recommended or quoted."
        defaultChecked={initial.isActive}
      />

      {state?.error && (
        <p className="text-[12.5px] text-danger bg-danger-soft border border-danger/15 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial.id ? "Save changes" : "Add product"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteProductButton({ productId, name }: { productId: string; name: string }) {
  return (
    <form
      action={deleteProduct}
      onSubmit={(e) => {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      <Button variant="danger" type="submit">
        <Trash2 size={14} />
        Delete product
      </Button>
    </form>
  );
}
