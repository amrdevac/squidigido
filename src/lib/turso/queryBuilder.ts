import { getClient } from "./client";

type WhereClause<T> = Partial<Record<keyof T, any>>;
type RelationType = "hasOne" | "hasMany";

interface Relation {
  type: RelationType;
  table: string;
  foreignKey: string;
  localKey: string;
}

class TursoQuery<T extends Record<string, any>> {
  private table: string;
  private whereClause: WhereClause<T> = {};
  private _limit?: number;
  private _offset?: number;
  private data: Partial<T> = {};
  private relations: Record<string, Relation> = {}; // <- simpan relasi yang mau diambil
  private _orderBy?: { column: keyof T; direction: "ASC" | "DESC" }; // 👈 baru


  constructor(table: string) {
    this.table = table;
  }

  where<K extends keyof T>(column: K, value: T[K]) {
    this.whereClause[column] = value;
    return this;
  }

  limit(n: number) {
    this._limit = n;
    return this;
  }

  offset(n: number) {
    this._offset = n;
    return this;
  }

  with(
    alias: string,
    relation: {
      type: RelationType;
      table: string;
      foreignKey: string;
      localKey: string;
    }
  ) {
    this.relations[alias] = relation;
    return this;
  }
  orderBy<K extends keyof T>(column: K, direction: "ASC" | "DESC" = "ASC") {
    this._orderBy = { column, direction };
    return this;
  }


  async get(): Promise<T[]> {
    const client = getClient();
    let sql = `SELECT * FROM ${this.table}`;
    const args: any[] = [];

    if (Object.keys(this.whereClause).length > 0) {
      const conditions = Object.keys(this.whereClause)
        .map((col) => `${col} = ?`)
        .join(" AND ");
      sql += ` WHERE ${conditions}`;
      args.push(...Object.values(this.whereClause));
    }


    // ✅ order by
    if (this._orderBy) {
      sql += ` ORDER BY ${String(this._orderBy.column)} ${this._orderBy.direction}`;
    }
    
    if (this._limit) sql += ` LIMIT ${this._limit}`;
    if (this._offset) sql += ` OFFSET ${this._offset}`;

    const result = await client.execute({ sql, args });
    const plain = result.rows.map((row) => ({ ...row })) as unknown as T[];

    // ---- handle relations
    if (Object.keys(this.relations).length > 0 && plain.length > 0) {
      for (const alias in this.relations) {
        const rel = this.relations[alias];

        if (rel.type === "hasOne") {
          for (const row of plain) {
            const relRes = await client.execute({
              sql: `SELECT * FROM ${rel.table} WHERE ${rel.foreignKey} = ? LIMIT 1`,
              args: [row[rel.localKey]],
            });
            (row as any)[alias] = relRes.rows[0] ? { ...relRes.rows[0] } : null;
          }
        }

        if (rel.type === "hasMany") {
          for (const row of plain) {
            const relRes = await client.execute({
              sql: `SELECT * FROM ${rel.table} WHERE ${rel.foreignKey} = ?`,
              args: [row[rel.localKey]],
            });
            (row as any)[alias] = relRes.rows.map((r) => ({ ...r }));
          }
        }
      }
    }

    return plain;
  }

  async find(): Promise<T | null> {
    const rows = await this.limit(1).get();
    return rows[0] || null;
  }

  create(data: Partial<T>) {
    this.data = data;
    return this;
  }

  async save(): Promise<{ success: true }> {
    const client = getClient();
    const cols = Object.keys(this.data);
    const placeholders = cols.map(() => "?").join(", ");
    const sql = `INSERT INTO ${this.table} (${cols.join(
      ","
    )}) VALUES (${placeholders})`;
    const args = Object.values(this.data);
    await client.execute({ sql, args });
    return { success: true };
  }

  async update(data: Partial<T>): Promise<{ success: true }> {
    const client = getClient();
    if (Object.keys(this.whereClause).length === 0) {
      throw new Error("Update needs a where clause!");
    }

    const setClause = Object.keys(data)
      .map((col) => `${col} = ?`)
      .join(", ");
    const whereClause = Object.keys(this.whereClause)
      .map((col) => `${col} = ?`)
      .join(" AND ");

    const sql = `UPDATE ${this.table} SET ${setClause} WHERE ${whereClause}`;
    const args = [...Object.values(data), ...Object.values(this.whereClause)];

    await client.execute({ sql, args });
    return { success: true };
  }

  async delete(): Promise<{ success: true }> {
    const client = getClient();
    if (Object.keys(this.whereClause).length === 0) {
      throw new Error("Delete needs a where clause!");
    }

    const whereClause = Object.keys(this.whereClause)
      .map((col) => `${col} = ?`)
      .join(" AND ");
    const sql = `DELETE FROM ${this.table} WHERE ${whereClause}`;
    const args = Object.values(this.whereClause).filter(
      (v): v is string | number | bigint | null => v !== undefined
    );

    await client.execute({ sql, args });
    return { success: true };
  }
}

export function turso<T extends Record<string, any>>(table: string) {
  return new TursoQuery<T>(table);
}
