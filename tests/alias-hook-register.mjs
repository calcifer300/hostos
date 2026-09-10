// Registers the "@/" resolver for the whole test process. Split from the hook
// itself because module hooks run on their own thread and must be registered,
// not merely imported.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./alias-hook.mjs", pathToFileURL(import.meta.filename));
