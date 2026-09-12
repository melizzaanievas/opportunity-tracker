import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, readdir, appendFile } from "node:fs/promises";

async function agentLog(payload) {
  const body = {
    sessionId: "c6c510",
    timestamp: Date.now(),
    ...payload,
  };
  await Promise.all([
    fetch("http://127.0.0.1:7289/ingest/ebf50ced-c691-4ba2-8255-7761f1d6dd9f", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "c6c510",
      },
      body: JSON.stringify(body),
    }).catch(() => {}),
    appendFile(
      "/Users/meliza/Github/opportunity-tracker/.cursor/debug-c6c510.log",
      JSON.stringify(body) + "\n",
    ).catch(() => {}),
  ]);
}

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  const entryPoint = path.resolve(artifactDir, "src/index.ts");
  // Emit .js so root start/Dockerfile can run artifacts/api-server/dist/index.js
  const outExtension = {};
  // #region agent log
  await agentLog({runId:'post-fix',hypothesisId:'A',location:'artifacts/api-server/build.mjs:buildAll:entry',message:'esbuild config before bundle',data:{artifactDir,distDir,entryPoint,outExtension,format:'esm'}});
  // #endregion

  await esbuild({
    entryPoints: [entryPoint],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });

  const distFiles = await readdir(distDir, { recursive: true });
  const hasIndexJs = distFiles.includes("index.js");
  // #region agent log
  await agentLog({runId:'post-fix',hypothesisId:'A,D',location:'artifacts/api-server/build.mjs:buildAll:after',message:'esbuild output files',data:{distDir,distFiles,hasIndexJs,hasIndexMjs:distFiles.includes('index.mjs')}});
  // #endregion
  if (!hasIndexJs) {
    throw new Error(
      `API server build did not produce dist/index.js. Output files: ${distFiles.join(", ")}`,
    );
  }
}

buildAll().catch(async (err) => {
  // #region agent log
  await agentLog({runId:'post-fix',hypothesisId:'B',location:'artifacts/api-server/build.mjs:catch',message:'buildAll failed',data:{error:String(err),stack:err?.stack}});
  // #endregion
  console.error(err);
  process.exit(1);
});
