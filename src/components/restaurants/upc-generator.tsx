"use client";

import * as React from "react";
import JsBarcode from "jsbarcode";
import { toast } from "sonner";
import { Check, Copy, Download, RefreshCw, ScanBarcode, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatUpc, generateUpc, generateUpcBatch, generateUpcFromName, validateUpc } from "@/lib/restaurants/upc";
import { downloadCsv } from "@/lib/restaurants/export";
import { cn } from "@/lib/utils";

function Barcode({ value, className }: { value: string; className?: string }) {
  const ref = React.useRef<SVGSVGElement>(null);
  React.useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, {
        format: "UPC",
        displayValue: true,
        fontSize: 14,
        height: 70,
        width: 2,
        margin: 8,
        background: "transparent",
        lineColor: "currentColor",
        font: "JetBrains Mono, ui-monospace, monospace",
      });
    } catch {
      // Invalid input renders nothing; the validator explains why.
    }
  }, [value]);
  return <svg ref={ref} className={cn("text-foreground", className)} role="img" aria-label={`Barcode ${value}`} />;
}

function CopyRow({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
      <span className="font-mono text-[13px] tabular-nums">{formatUpc(code)}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? <Check className="text-success" /> : <Copy />}
      </Button>
    </div>
  );
}

export function UpcGenerator() {
  const [single, setSingle] = React.useState(() => generateUpc());
  const [name, setName] = React.useState("");
  const [batchCount, setBatchCount] = React.useState(10);
  const [batch, setBatch] = React.useState<string[]>([]);
  const [check, setCheck] = React.useState("");
  const fromName = name.trim() ? generateUpcFromName(name) : null;
  const validation = check.trim() ? validateUpc(check) : null;

  function downloadSvg(code: string) {
    const svg = document.querySelector<SVGSVGElement>(`svg[aria-label="Barcode ${code}"]`);
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `upc-${code}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">UPC generator</h1>
        <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
          Mints valid UPC-A codes with a real GS1 check digit for items that don&rsquo;t have one yet, using the &ldquo;2&rdquo;
          prefix reserved for in-store use — safe to put on a POS or a DoorDash menu without colliding with a registered
          product.
        </p>
      </div>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single">Single</TabsTrigger>
          <TabsTrigger value="name">From a name</TabsTrigger>
          <TabsTrigger value="batch">Batch</TabsTrigger>
          <TabsTrigger value="validate">Validate</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card padding="lg" className="flex flex-col items-center gap-5 text-center">
            <Barcode value={single} />
            <CopyRow code={single} />
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => setSingle(generateUpc())}>
                <RefreshCw /> Generate another
              </Button>
              <Button variant="secondary" onClick={() => downloadSvg(single)}>
                <Download /> SVG
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="name">
          <Card padding="lg" className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="upc-name">Item name</Label>
              <Input id="upc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Halloumi fries" />
              <p className="text-[12px] text-muted-foreground">
                Deterministic: the same name always produces the same code, so it can be regenerated later and still match.
              </p>
            </div>
            {fromName && (
              <div className="flex flex-col items-center gap-4">
                <Barcode value={fromName} />
                <CopyRow code={fromName} />
                <Button variant="secondary" onClick={() => downloadSvg(fromName)}>
                  <Download /> SVG
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="batch">
          <Card padding="lg" className="space-y-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="upc-count">How many</Label>
                <Input id="upc-count" type="number" min={1} max={500} value={batchCount} onChange={(e) => setBatchCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} className="w-32" />
              </div>
              <Button variant="primary" onClick={() => setBatch(generateUpcBatch(batchCount))}>
                <Wand2 /> Generate
              </Button>
              <Button
                variant="secondary"
                disabled={batch.length === 0}
                onClick={() => {
                  downloadCsv(["UPC"].concat(batch).join("\n"), `upc-batch-${batch.length}.csv`);
                  toast.success("CSV downloaded");
                }}
              >
                <Download /> CSV
              </Button>
            </div>
            {batch.length > 0 && (
              <div className="grid max-h-[420px] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                {batch.map((code) => (
                  <CopyRow key={code} code={code} />
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="validate">
          <Card padding="lg" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="upc-check">UPC-A to check</Label>
              <Input id="upc-check" value={check} onChange={(e) => setCheck(e.target.value)} placeholder="12 digits" className="font-mono" />
            </div>
            {validation && (
              <div className={cn("flex items-start gap-2 rounded-xl border px-3.5 py-3 text-[13px]", validation.valid ? "border-success/40 bg-success-bg text-success" : "border-danger/40 bg-danger-bg text-danger")}>
                <ScanBarcode className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">{validation.valid ? "Valid UPC-A" : "Not a valid UPC-A"}</p>
                  {validation.reason && <p className="mt-0.5 text-[12.5px] opacity-90">{validation.reason}</p>}
                </div>
              </div>
            )}
            {validation?.valid && <Barcode value={check.replace(/\D/g, "")} className="mx-auto" />}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
