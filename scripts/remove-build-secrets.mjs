import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const copiedDevVars = resolve("dist", "intenthour", ".dev.vars");
await rm(copiedDevVars, { force: true });
