import { client, ensureIndexes } from "@/lib/db";

ensureIndexes()
  .then(() => console.log("Indexes ensured."))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.close());
