import mysql, { RowDataPacket } from "mysql2/promise";
import { DbConfig } from "../model/dbconfig";

export class Db {
  private conn: mysql.Connection;
  private dbConfig: DbConfig;
    
  constructor(dbConfig: DbConfig, conn: mysql.Connection) {
    this.conn = conn;
    this.dbConfig = dbConfig;
  }

  static async init(dbConfig: DbConfig) : Promise<Db> {
    const conn = await mysql.createConnection(dbConfig);
    return new Db(dbConfig, conn);
  }

  async getTableDefinitions(): Promise<{ name: string; sql: string; }[]> {
    const [tables] = await this.conn.execute(`
      SELECT TABLE_NAME AS name 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_type = 'BASE TABLE'
    `, [this.dbConfig.database]);
  
    const definitions = [];
    for (const table of tables as RowDataPacket[]) {
      const [rows] = await this.conn.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${table.name}\``);
      const createSql = rows[0]["Create Table"];
  
      definitions.push({
        name: table.name,
        sql: createSql
      });
    }
    return definitions;
  }

  async getColumnDefinition(tableName: string, definition? : string) : Promise<any>{
    
    const [columns] = await this.conn.execute(`
        SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
        FROM information_schema.columns
        WHERE table_schema = ? AND table_name = ?
      `, [this.dbConfig.database, tableName]);
      const baseResult = {
        tableName,
        columns: (columns as any[]).map(col => ({
          name: col.name,
          type: col.type,
          notNull: col.IS_NULLABLE === "NO",
          defaultValue: col.COLUMN_DEFAULT,
          isPrimaryKey: col.COLUMN_KEY === "PRI"
        }))
      };
      return definition !== undefined 
        ? { ...baseResult, definition } : baseResult;
  }

  async getColumnDefinitions(detailed: boolean) : Promise<{name:string, definition: string}[]>{
    const result = [];
    const tables = await this.getTableDefinitions();
    for (const { name, sql: definition } of tables) {
      if (detailed) {
        result.push(await this.getColumnDefinition(name));
      } else {
        result.push({ name, definition });
      }
    }
    return result;
  }

  async getTableInfo(tableName:string) : Promise<any>{
    const [exists] = await this.conn.execute(
        `SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`,
        [this.dbConfig.database, tableName]
      );
      if ((exists as any[]).length === 0) {
        return {
          content: [{ type: "text", text: `Error: Table "${tableName}" does not exist.` }],
          isError: true
        };
      }
   
      const [sampleRows] = await this.conn.query(`SELECT * FROM \`${tableName}\` LIMIT 5`);
      const [rowCount] = await this.conn.query(`SELECT COUNT(*) AS count FROM \`${tableName}\``);
  
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            tableName,
            columns: await this.getColumnDefinition(tableName),
            rowCount: (rowCount as any)[0].count,
            sampleData: sampleRows
          }, null, 2)
        }]
      };
  }

  async query(sql : string) : Promise<any> {
    const [results] = await this.conn.query(sql);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(results, null, 2),
      }]
    }
  }

  async close() : Promise<void> {
    await this.conn.end();
  }
}
