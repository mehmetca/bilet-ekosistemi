"use client";

import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

const TOOLBAR_OPTIONS = [
  ["bold", "italic", "underline"],
  [{ size: ["small", false, "large", "huge"] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link"],
  ["clean"],
];

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Metin girin...",
  className = "",
  minHeight = "120px",
}: RichTextEditorProps) {
  return (
    <div className={`[&_.ql-container]:min-h-[120px] [&_.ql-editor]:min-h-[120px] ${className}`}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={{ toolbar: TOOLBAR_OPTIONS }}
        className="[&_.ql-toolbar]:rounded-t-lg [&_.ql-container]:rounded-b-lg"
      />
    </div>
  );
}
