import sequelize from "./dbconfig";

/**
 * sequelize.sync({ alter }) adds new columns but leaves existing ENUM columns as they were, so a value added
 * to a model (a new team role, payment method, notification type...) is rejected by the database.
 * This widens every ENUM column to the model's values plus any values already in the database
 * (never removes one, so no row loses data). Safe to run on every deploy.
 */
export const syncEnumColumns = async () => {
    const [dbRow]: any = await sequelize.query("SELECT DATABASE() AS db");
    const db = dbRow?.[0]?.db;
    if (!db) return;
    for (const model of Object.values(sequelize.models) as any[]) {
        const table = model.getTableName();
        const tableName = typeof table === "string" ? table : table.tableName;
        for (const [name, attr] of Object.entries<any>(model.rawAttributes)) {
            if (attr?.type?.key !== "ENUM" || !Array.isArray(attr.values)) continue;
            const column = attr.field || name;
            const [rows]: any = await sequelize.query(
                "SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                { replacements: [db, tableName, column] },
            );
            const info = rows?.[0];
            if (!info || !/^enum\(/i.test(info.COLUMN_TYPE)) continue;
            const existing = [...String(info.COLUMN_TYPE).matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));
            const missing = attr.values.filter((v: string) => !existing.includes(v));
            if (!missing.length) continue;
            const all = [...attr.values, ...existing.filter((v) => !attr.values.includes(v))];
            const list = all.map((v) => sequelize.escape(v)).join(",");
            const nullable = info.IS_NULLABLE === "YES" ? "NULL" : "NOT NULL";
            const def = info.COLUMN_DEFAULT === null || info.COLUMN_DEFAULT === undefined ? (nullable === "NULL" ? " DEFAULT NULL" : "") : ` DEFAULT ${sequelize.escape(String(info.COLUMN_DEFAULT).replace(/^'|'$/g, ""))}`;
            await sequelize.query(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${column}\` ENUM(${list}) ${nullable}${def}`);
            console.log(`✅ ENUM ${tableName}.${column}: added ${missing.join(", ")}`);
        }
    }
};
