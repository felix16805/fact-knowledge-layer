"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileText, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      return;
    }
    
    setError(null);
    setIsUploading(true);

    try {
      // 1. Get signed upload URL
      const urlRes = await fetch(`/api/upload-url?filename=${encodeURIComponent(file.name)}`);
      
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { signedUploadUrl, token, storagePath } = await urlRes.json();

      // 2. Upload to Supabase Storage
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("pdfs")
        .uploadToSignedUrl(storagePath, token, file, {
          contentType: file.type,
        });

      if (uploadError) {
        console.error('Upload failed:', uploadError);
        throw new Error(`Failed to upload file to storage: ${uploadError.message}`);
      }

      // 3. Register document in database
      const docRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, storagePath }),
      });

      if (!docRes.ok) {
        const errBody = await docRes.json().catch(() => ({}));
        console.error("Register failed:", docRes.status, errBody);
        throw new Error(`Failed to register document: ${JSON.stringify(errBody)}`);
      }
      const doc = await docRes.json();

      // Navigate to the document inspection page
      router.push(`/documents/${doc.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div
        className={`relative border-2 border-dashed transition-all duration-200 ease-in-out p-12 flex flex-col items-center justify-center text-center cursor-pointer ${
          isDragging 
            ? "border-primary bg-primary/5" 
            : "border-border hover:border-muted-foreground/50 hover:bg-secondary/20"
        } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          ref={fileInputRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        
        {isUploading ? (
          <Loader2 className="w-10 h-10 text-muted-foreground animate-spin mb-4" />
        ) : (
          <UploadCloud className="w-10 h-10 text-muted-foreground mb-4" />
        )}
        
        <h3 className="text-lg font-medium text-foreground mb-1">
          {isUploading ? "Processing Document..." : "Upload PDF Document"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Drag and drop your PDF here, or click to browse. Strict PDF format required for deterministic extraction.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
