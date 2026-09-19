#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server.mjs");
await import(pathToFileURL(serverPath).href);
