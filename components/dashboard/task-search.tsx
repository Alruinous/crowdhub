"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface TaskSearchProps {
  placeholder?: string;
  queryKey?: string; // 默认使用 "search"
  className?: string;
}

export function TaskSearch({ placeholder, queryKey = "search", className }: TaskSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get(queryKey) || "";
  const [value, setValue] = useState(initial);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set(queryKey, value.trim());
    else params.delete(queryKey);
    params.set("page", "1");
    router.push(`/dashboard?${params.toString()}`);
  };

  const clear = () => {
    setValue("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete(queryKey);
    params.set("page", "1");
    router.push(`/dashboard?${params.toString()}`);
  };

  // 避免 SSR 与客户端初始值不一致造成水合警告
  if (!mounted) {
    return null;
  }

  return (
    <form onSubmit={submit} className={`flex items-center gap-2 ${className || ""}`}>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder || "搜索任务"}
        className="h-9 w-48"
      />
      <Button type="submit" size="icon" aria-label="搜索">
        <Search className="h-4 w-4" />
      </Button>
      {value && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="清除搜索"
          onClick={clear}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
}