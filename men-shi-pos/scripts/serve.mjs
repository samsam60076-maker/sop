import { spawn } from "node:child_process";

const port = process.env.PORT || "3847";
const child = spawn(
  "npx",
  ["next", "start", "--hostname", "0.0.0.0", "--port", port],
  { stdio: "inherit", shell: true },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
