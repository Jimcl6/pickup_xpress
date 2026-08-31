import("./apps/server/dist/index.js").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
