import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// キーは、案件フォルダ直下の .env.local に置いている（git管理外）。1つ上のフォルダから読み込む
// （Next.jsは先に自分のフォルダを読み込み済みなので、最後の true で、読み込み直しを指定する）
loadEnvConfig(
  path.resolve(process.cwd(), ".."),
  process.env.NODE_ENV !== "production",
  undefined,
  true,
);

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
