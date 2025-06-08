import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import { Db } from "./base/db";
import { DbConfig } from "./model/dbconfig";
import { existsSync } from 'fs'
import { count } from "console";
import path from "path";

const args = process.argv.slice(1);
const flags = Object.fromEntries(
  args
    .filter(arg => arg.startsWith("--"))
    .map(arg => {
      const [key, value] = arg.slice(2).split("=");
      return [key, value ?? true];
    })
);

if (flags.envpath) {
  const envPath = path.resolve(flags.envpath);
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const server = new McpServer({ name: "CustomerDB", version: "0.0.1" });
const dbConfig : DbConfig = {
  host: process.env.DB_HOST!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!
};


server.resource("schema", "schema://main", async (uri) => {
  const db = await Db.init(dbConfig);

  try {
    const tables = await db.getTableDefinitions();
    return {
      contents: [{
        uri: uri.href,
        text: tables.map(t => t.sql).join("\n\n"),
        metadata: {
          title: "Database Schema",
          description: "Schema definition for all tables in the database",
          tableCount: tables.length,
          tableNames: tables.map(t => t.name)
        }
      }]
    };
  } finally {
    await db.close();
  }
});

server.tool("getSchema", { detailed: z.boolean().optional().default(false) }, async ({ detailed }) => {
  const db = await Db.init(dbConfig);

  try {
    const result = await db.getColumnDefinitions(detailed)
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error fetching schema: ${(err as Error).message}` }],
      isError: true
    };
  } finally {
    await db.close()
  }
});

server.tool("query", { sql: z.string() }, async ({ sql }) => {
  const trimmedSql = sql.trim().toLowerCase();

  if (!trimmedSql.startsWith("select")) {
    return {
      content: [{ type: "text", text: "Error: Only SELECT queries are allowed." }],
      isError: true
    };
  }
  const db = await Db.init(dbConfig);

  try {
    return await db.query(sql);
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
      isError: true
    };
  } finally {
    await db.close();
  }
});

server.tool("tableInfo", { tableName: z.string() }, async ({ tableName }) => {
  const db = await Db.init(dbConfig);
  try {
    return await db.getTableInfo(tableName);
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
      isError: true
    };
  } finally {
    await db.close();
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MCP server started");
