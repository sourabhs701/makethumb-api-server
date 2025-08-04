// import { drizzle } from "drizzle-orm/libsql";
// import { createClient } from "@libsql/client";

// const client = createClient({
//   url: "file:./data/makethumb.db",
// });

// export const db = drizzle(client);

import { drizzle } from "drizzle-orm/node-postgres";

export const db = drizzle(process.env.DATABASE_URL);

const result = await db.execute("select 1");

console.log(result);
