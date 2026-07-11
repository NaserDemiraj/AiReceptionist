import { Card } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { ImportForm } from "@/features/products/components/import-form";

export const metadata = { title: "Import products" };

const EXAMPLE = `name,category,price,saleprice,stock,colors,materials,style,widthcm,depthcm,heightcm,seats,deliverydays,warrantymonths,description
Oslo Corner Sofa,Sofas,899,,14,grey;beige,fabric;oak,scandinavian,260,160,84,5,5,24,Comfortable corner sofa
Luna Bed,Beds,549,479,12,grey;blush,fabric;pine,modern,176,215,112,,4,24,Upholstered double bed`;

export default async function ImportProductsPage() {
  await requireOrg();

  return (
    <>
      <Topbar title="Import products" />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <div className="max-w-[760px] space-y-4">
          <Card className="p-6">
            <h2 className="text-[15px] font-semibold mb-1">Upload a CSV file</h2>
            <p className="text-[12.5px] text-ink-mid mb-5">
              Bulk-load your whole catalog in one go. Required columns:{" "}
              <code className="font-mono text-[11.5px] bg-hover px-1.5 py-0.5 rounded">name</code>{" "}
              and{" "}
              <code className="font-mono text-[11.5px] bg-hover px-1.5 py-0.5 rounded">price</code>.
              Everything else is optional. Categories are created automatically. Max 500 rows per
              file.
            </p>
            <ImportForm />
          </Card>

          <Card className="p-6">
            <h2 className="text-[14px] font-semibold mb-3">Example file</h2>
            <pre className="font-mono text-[11px] bg-hover border border-line rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre">
              {EXAMPLE}
            </pre>
            <p className="text-[11.5px] text-ink-soft mt-3">
              Separate multiple colors/materials with <code className="font-mono">;</code> inside a
              cell. Exports from Excel and Google Sheets work as-is (File → Download → CSV).
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
