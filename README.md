# CustomerDB MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) compatible server for querying a MySQL database.  
This server exposes schema and query tools so that clients like Claude or other MCP-capable interfaces can explore and interact with your database securely.

---

## 🔧 Features

- ✅ Access to full database schema via `schema://main`
- 🔍 Tools:
  - `getSchema`: Returns tables and columns, optionally with details
  - `query`: Executes safe `SELECT` queries only
  - `tableInfo`: Provides metadata and sample rows from a table
- 🛡️ Security: Only read access (SELECT) is permitted
- 📁 Environment configuration via CLI flag

---

## 📦 Requirements

- Node.js 18+
- MySQL or MariaDB database
- `.env` file with valid database connection credentials:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=yourdatabase

------Claude Config-------

claude_desktop_config.json

{
  "mcpServers": {
    "customerdb": {
      "command": "npx",
      "args": [
        "tsx",
        "pathto/mcp-sql-server/src/index.ts",
        "--envpath=pathto/mcp-sql-server/.env"
      ],
      "metadata": {
        "description": "SQL database access server with schema information",
        "resources": [
          {
            "uri": "schema://main",
            "description": "Database schema definitions"
          }
        ],
        "autoFetchResources": ["schema://main"]
      }
    }
  }
}