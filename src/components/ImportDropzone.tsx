import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

type ImportDropzoneProps = {
  isImporting: boolean;
  onImport: (files: File[]) => void;
};

export function ImportDropzone({ isImporting, onImport }: ImportDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).filter(
      (file) => file.name.toLowerCase().endsWith(".json") || file.name.toLowerCase().endsWith(".zip")
    );
    if (files.length > 0) onImport(files);
  }

  return (
    <section
      className={`dropzone ${isDragging ? "dropzoneActive" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <div className="dropIcon">
        <UploadCloud aria-hidden="true" size={28} />
      </div>
      <div>
        <h2>Upload ZIP here</h2>
        <p>Drop your Spotify history ZIP or choose it from your computer.</p>
      </div>
      <button className="primaryButton" onClick={() => inputRef.current?.click()} disabled={isImporting}>
        {isImporting ? "Importing..." : "Choose files"}
      </button>
      <input
        ref={inputRef}
        hidden
        multiple
        type="file"
        accept=".zip,.json,application/json,application/zip"
        onChange={(event) => handleFiles(event.currentTarget.files)}
      />
    </section>
  );
}
