"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { updateWebsite } from "../actions";
import { Button, Field, Input } from "@/components/ui";
import { Toggle } from "@/features/ai-config/components/persona-form";
import type { SiteService } from "../site-data";

export interface WebsiteEditorValues {
  published: boolean;
  heroTitle: string;
  heroSubtitle: string;
  aboutText: string;
  primaryColor: string;
  seoTitle: string;
  seoDescription: string;
  googleMapsUrl: string;
  showProducts: boolean;
  showContactForm: boolean;
  services: SiteService[];
}

export function WebsiteEditor({ initial }: { initial: WebsiteEditorValues }) {
  const [state, formAction, pending] = useActionState(updateWebsite, undefined);
  const [services, setServices] = useState<SiteService[]>(initial.services);

  const textareaCls =
    "w-full px-3.5 py-2.5 bg-card border border-line rounded-[10px] text-[13.5px] text-ink placeholder:text-ink-soft outline-none focus:border-accent-line focus:ring-2 focus:ring-accent-soft transition resize-y";

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="services" value={JSON.stringify(services)} />

      <Toggle
        name="published"
        label="Publish website"
        hint="When off, only your team can preview the site."
        defaultChecked={initial.published}
      />

      <div className="border-t border-line pt-4">
        <h3 className="text-[13.5px] font-semibold mb-3">Hero</h3>
        <div className="space-y-3.5">
          <Field label="Headline">
            <Input
              name="heroTitle"
              defaultValue={initial.heroTitle}
              placeholder="Beautiful furniture for every home"
            />
          </Field>
          <Field label="Subheadline">
            <Input
              name="heroSubtitle"
              defaultValue={initial.heroSubtitle}
              placeholder="Family-run showroom in Tirana — quality furniture, fair prices, fast delivery."
            />
          </Field>
        </div>
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="text-[13.5px] font-semibold mb-3">About</h3>
        <textarea
          name="aboutText"
          rows={4}
          defaultValue={initial.aboutText}
          placeholder="Tell your story — who you are, how long you've been around, what makes you different…"
          className={textareaCls}
        />
      </div>

      <div className="border-t border-line pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13.5px] font-semibold">Services</h3>
          <Button
            type="button"
            variant="secondary"
            className="h-8 px-3 text-[12px]"
            onClick={() => setServices((s) => [...s, { title: "", description: "" }])}
            disabled={services.length >= 8}
          >
            <Plus size={13} /> Add
          </Button>
        </div>
        {services.length === 0 ? (
          <p className="text-[12px] text-ink-soft">No services listed — the section stays hidden.</p>
        ) : (
          <div className="space-y-2.5">
            {services.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={s.title}
                  placeholder="Free delivery"
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                    )
                  }
                  className="max-w-[200px]"
                />
                <Input
                  value={s.description}
                  placeholder="Short description"
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => setServices((prev) => prev.filter((_, j) => j !== i))}
                  className="w-9 h-[40px] shrink-0 flex items-center justify-center rounded-lg text-ink-soft hover:text-danger hover:bg-danger-soft cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="text-[13.5px] font-semibold mb-3">Appearance & sections</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Brand color">
            <input
              type="color"
              name="primaryColor"
              defaultValue={initial.primaryColor}
              className="w-[52px] h-[40px] p-1 bg-card border border-line rounded-[10px] cursor-pointer"
            />
          </Field>
          <Field label="Google Maps embed URL (optional)">
            <Input
              name="googleMapsUrl"
              defaultValue={initial.googleMapsUrl}
              placeholder="https://www.google.com/maps/embed?pb=…"
            />
          </Field>
        </div>
        <div className="space-y-3">
          <Toggle
            name="showProducts"
            label="Show product catalog"
            defaultChecked={initial.showProducts}
          />
          <Toggle
            name="showContactForm"
            label="Show contact form"
            hint="Submissions become leads automatically."
            defaultChecked={initial.showContactForm}
          />
        </div>
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="text-[13.5px] font-semibold mb-3">SEO</h3>
        <div className="space-y-3.5">
          <Field label="Page title (max 70 chars)">
            <Input
              name="seoTitle"
              maxLength={70}
              defaultValue={initial.seoTitle}
              placeholder="MAMAJ Furniture — Quality furniture in Tirana"
            />
          </Field>
          <Field label="Meta description (max 170 chars)">
            <Input
              name="seoDescription"
              maxLength={170}
              defaultValue={initial.seoDescription}
              placeholder="Sofas, beds and dining furniture with fast delivery across Albania…"
            />
          </Field>
        </div>
      </div>

      {state?.error && (
        <p className="text-[12.5px] text-danger bg-danger-soft border border-danger/15 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-[12.5px] text-positive-strong bg-positive-soft border border-positive-line rounded-lg px-3 py-2">
          Website saved.
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save website"}
      </Button>
    </form>
  );
}
