"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

interface Option {
  id: string;
  name: string;
  type?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "— Select —",
  disabled = false,
  className = "",
}: {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value);

  const filtered = search
    ? options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { if (!disabled) { setOpen(!open); setSearch(""); } }}
        disabled={disabled}
        className={`w-full flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm text-left focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${
          value
            ? "border-green-300 bg-green-50 text-green-800"
            : "border-amber-300 bg-amber-50 text-amber-800"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className="truncate">{selected?.name || placeholder}</span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 ml-1 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 rounded-lg border border-gray-200 bg-white shadow-lg flex flex-col">
          <div className="flex items-center border-b border-gray-100 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-gray-400 mr-2 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full text-sm outline-none placeholder-gray-400"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {!value && (
              <button
                className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50"
                onClick={() => { setOpen(false); setSearch(""); }}
              >
                {placeholder}
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">No matches</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-50 ${
                    o.id === value ? "bg-green-50 text-green-800 font-medium" : "text-gray-700"
                  }`}
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  {o.name}
                  {o.type && <span className="text-xs text-gray-400 ml-1">({o.type})</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
