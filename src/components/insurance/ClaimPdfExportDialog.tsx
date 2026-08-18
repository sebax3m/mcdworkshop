/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Loader2, Download, FileArchive, Images } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import type { ClaimPdfData } from "@/lib/claim-pdf";
import { MAX_ATTACHMENT_BYTES } from "@/lib/pdf-attachments";

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

export function ClaimPdfExportDialog({
  open,
  onOpenChange,
  data,
  fileBaseName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: Omit<ClaimPdfData, "options">;
  fileBaseName: string;
}) {
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [maxPhotos, setMaxPhotos] = useState(20);
  const [quality, setQuality] = useState(70);
  const [building, setBuilding] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [est, setEst] = useState<{
    pdfSize: number;
    zipSize: number;
    photos: number;
    parts: number;
  } | null>(null);
  const [result, setResult] = useState<{ size: number; parts: number; names: string[] } | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setEst(null);
    (async () => {
      const { countClaimPhotos } = await import("@/lib/claim-pdf");
      const n = await countClaimPhotos(data.claim.id);
      setPhotoCount(n);
      setMaxPhotos(Math.max(1, n));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data.claim.id]);

  // Any option change invalidates the previous estimate.
  useEffect(() => {
    setEst(null);
  }, [includePhotos, maxPhotos, quality]);

  const buildOptions = () => ({
    includePhotos,
    maxPhotos: includePhotos ? maxPhotos : 0,
    photoQuality: quality / 100,
    photoMaxWidth: quality >= 80 ? 1400 : quality >= 60 ? 1000 : 700,
  });

  const estimate = async () => {
    setEstimating(true);
    try {
      const { buildClaimPdf } = await import("@/lib/claim-pdf");
      const { estimateAttachments } = await import("@/lib/pdf-attachments");
      const blob = await buildClaimPdf({ ...data, options: buildOptions() });
      const e = await estimateAttachments(blob, fileBaseName);
      setEst({
        pdfSize: e.pdfSize,
        zipSize: e.zipSize,
        parts: e.parts,
        photos: includePhotos ? Math.min(maxPhotos, photoCount ?? maxPhotos) : 0,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to calculate size");
    } finally {
      setEstimating(false);
    }
  };

  const build = async (minParts = 1) => {
    setBuilding(true);
    try {
      const { buildClaimPdf } = await import("@/lib/claim-pdf");
      const { preparePdfAttachments, downloadFile } = await import("@/lib/pdf-attachments");
      const blob = await buildClaimPdf({ ...data, options: buildOptions() });
      const prepared = await preparePdfAttachments(blob, fileBaseName, { minParts });
      prepared.forEach((p, i) => setTimeout(() => downloadFile(p.file), i * 400));
      setResult({
        size: blob.size,
        parts: prepared.length,
        names: prepared.map((p) => p.file.name),
      });
      toast.success(
        prepared.length > 1
          ? `Downloaded ${prepared.length} volumes — open the .zip to extract the single PDF`
          : prepared[0].zipped
            ? "Downloaded as .zip (over 24 MB)"
            : "PDF downloaded",
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate PDF");
    } finally {
      setBuilding(false);
    }
  };

  const tooBig = result && result.parts === 1 && result.size > MAX_ATTACHMENT_BYTES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export claim PDF</DialogTitle>
          <DialogDescription>
            Files over 24 MB are zipped automatically. Reduce photos to keep it emailable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Images className="h-4 w-4" /> Include damage photos
              </Label>
              <p className="text-xs text-muted-foreground">
                {photoCount === null ? "Checking…" : `${photoCount} photo(s) on this claim`}
              </p>
            </div>
            <Switch checked={includePhotos} onCheckedChange={setIncludePhotos} />
          </div>

          {includePhotos && (photoCount ?? 0) > 0 && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">
                  Photos included: {Math.min(maxPhotos, photoCount ?? maxPhotos)} of {photoCount}
                </Label>
                <Slider
                  min={1}
                  max={Math.max(1, photoCount ?? 1)}
                  step={1}
                  value={[maxPhotos]}
                  onValueChange={(v) => setMaxPhotos(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Photo quality: {quality}%</Label>
                <Slider
                  min={30}
                  max={95}
                  step={5}
                  value={[quality]}
                  onValueChange={(v) => setQuality(v[0])}
                />
              </div>
            </>
          )}

          {result && (
            <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs space-y-1">
              <div>
                PDF size: <strong>{mb(result.size)}</strong> ·{" "}
                {result.parts > 1 ? `${result.parts} zip parts` : "1 file"}
              </div>
              <div className="text-muted-foreground break-all">{result.names.join(", ")}</div>
              {tooBig && (
                <div className="text-amber-600">
                  Still over 24 MB after zipping — split it or remove photos.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            disabled={building}
            onClick={() => build(2)}
            className="gap-2"
            title="Split into 2 zip files"
          >
            <FileArchive className="h-4 w-4" /> Split in 2 zips
          </Button>
          <Button disabled={building} onClick={() => build(1)} className="gap-2">
            {building ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Build & download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
