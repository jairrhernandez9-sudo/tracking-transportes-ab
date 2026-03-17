/**
 * sync-schema.js
 * Compara ambas DBs (local + Railway) contra el schema esperado
 * y aplica las ALTER TABLE / CREATE TABLE que falten.
 *
 * Uso: node database/sync-schema.js
 */

const mysql = require('mysql2/promise');

// ─── Conexiones ────────────────────────────────────────────
const LOCAL = {
  host: 'localhost', user: 'root', password: 'root',
  database: 'tracking_local', port: 3306
};

const RAILWAY = {
  host: 'shuttle.proxy.rlwy.net', user: 'root',
  password: 'UWfQChJPLuUJfGAoYLsCDyhLdgpqTRqw',
  database: 'railway', port: 17996,
  ssl: { rejectUnauthorized: false }
};

// ─── Estructura esperada ────────────────────────────────────
// Sólo definimos columnas nuevas/faltantes que queremos garantizar.
// Formato: { table, column, definition }
const EXPECTED_COLUMNS = [
  // usuarios
  { table: 'usuarios', column: 'pagina_inicio',           def: "VARCHAR(50) NOT NULL DEFAULT 'dashboard' AFTER `activo`" },
  { table: 'usuarios', column: 'ultimo_cliente_id',       def: 'INT DEFAULT NULL AFTER `pagina_inicio`' },
  { table: 'usuarios', column: 'alias',                   def: "VARCHAR(80) DEFAULT NULL COMMENT 'Nombre público / cargo mostrado al cliente' AFTER `ultimo_cliente_id`" },
  { table: 'usuarios', column: 'ultimo_lugar_expedicion', def: "VARCHAR(200) DEFAULT NULL COMMENT 'Último lugar de expedición usado al imprimir la Guía Expedida' AFTER `alias`" },

  // clientes
  { table: 'clientes', column: 'habilitado',           def: "TINYINT(1) DEFAULT '1' AFTER `activo`" },
  { table: 'clientes', column: 'eliminado_en',         def: 'DATETIME DEFAULT NULL' },
  { table: 'clientes', column: 'template_etiqueta_id', def: "INT NULL COMMENT 'FK a etiqueta_templates'" },
  { table: 'clientes', column: 'template_guia_id',     def: "INT NULL COMMENT 'FK a guia_templates'" },
  { table: 'clientes', column: 'metodo_pago_defecto',  def: "VARCHAR(3) NOT NULL DEFAULT 'PPD' COMMENT 'PUE o PPD (SAT)'" },

  // envios — desglose origen
  { table: 'envios', column: 'cliente_nombre',       def: 'VARCHAR(255) DEFAULT NULL AFTER `cliente_id`' },
  { table: 'envios', column: 'origen_calle',         def: 'VARCHAR(255) DEFAULT NULL AFTER `origen`' },
  { table: 'envios', column: 'origen_colonia',       def: 'VARCHAR(100) DEFAULT NULL AFTER `origen_calle`' },
  { table: 'envios', column: 'origen_ciudad',        def: 'VARCHAR(100) DEFAULT NULL AFTER `origen_colonia`' },
  { table: 'envios', column: 'origen_estado',        def: 'VARCHAR(50) DEFAULT NULL AFTER `origen_ciudad`' },
  { table: 'envios', column: 'origen_cp',            def: 'VARCHAR(5) DEFAULT NULL AFTER `origen_estado`' },
  { table: 'envios', column: 'origen_referencia',    def: 'VARCHAR(255) DEFAULT NULL AFTER `origen_cp`' },
  // envios — desglose destino
  { table: 'envios', column: 'destino_calle',        def: 'VARCHAR(255) DEFAULT NULL AFTER `destino`' },
  { table: 'envios', column: 'destino_colonia',      def: 'VARCHAR(100) DEFAULT NULL AFTER `destino_calle`' },
  { table: 'envios', column: 'destino_ciudad',       def: 'VARCHAR(100) DEFAULT NULL AFTER `destino_colonia`' },
  { table: 'envios', column: 'destino_estado',       def: 'VARCHAR(50) DEFAULT NULL AFTER `destino_estado`' },
  { table: 'envios', column: 'destino_cp',           def: 'VARCHAR(5) DEFAULT NULL AFTER `destino_estado`' },
  { table: 'envios', column: 'destino_referencia',   def: 'VARCHAR(255) DEFAULT NULL AFTER `destino_cp`' },
  // envios — otros
  { table: 'envios', column: 'referencia_cliente',      def: 'VARCHAR(100) DEFAULT NULL' },
  { table: 'envios', column: 'fecha_estimada_entrega',  def: 'DATE DEFAULT NULL' },
  { table: 'envios', column: 'es_parcial',              def: "TINYINT(1) NOT NULL DEFAULT '0'" },
  { table: 'envios', column: 'envio_relacionado_id',    def: 'INT DEFAULT NULL' },
  { table: 'envios', column: 'es_complemento',          def: "TINYINT(1) NOT NULL DEFAULT '0'" },
  { table: 'envios', column: 'numero_parte',            def: 'INT DEFAULT NULL' },
  { table: 'envios', column: 'etiqueta_modificada',     def: "TINYINT(1) NOT NULL DEFAULT '0'" },
  { table: 'envios', column: 'metodo_pago',             def: "VARCHAR(3) NOT NULL DEFAULT 'PPD' COMMENT 'PUE o PPD (SAT)'" },

  // etiqueta_templates — dest
  { table: 'etiqueta_templates', column: 'mostrar_dest_nombre',        def: "TINYINT(1) NOT NULL DEFAULT 1" },
  { table: 'etiqueta_templates', column: 'mostrar_dest_direccion',     def: "TINYINT(1) NOT NULL DEFAULT 1" },
  { table: 'etiqueta_templates', column: 'mostrar_dest_referencia',    def: "TINYINT(1) NOT NULL DEFAULT 1" },
  { table: 'etiqueta_templates', column: 'mostrar_dest_contacto',      def: "TINYINT(1) NOT NULL DEFAULT 1" },
  { table: 'etiqueta_templates', column: 'mostrar_dest_telefono',      def: "TINYINT(1) NOT NULL DEFAULT 1" },
  { table: 'etiqueta_templates', column: 'obligatorio_dest_nombre',    def: "TINYINT(1) NOT NULL DEFAULT 0" },
  { table: 'etiqueta_templates', column: 'obligatorio_dest_direccion', def: "TINYINT(1) NOT NULL DEFAULT 0" },
  { table: 'etiqueta_templates', column: 'obligatorio_dest_referencia',def: "TINYINT(1) NOT NULL DEFAULT 0" },
  { table: 'etiqueta_templates', column: 'obligatorio_dest_contacto',  def: "TINYINT(1) NOT NULL DEFAULT 0" },
  { table: 'etiqueta_templates', column: 'obligatorio_dest_telefono',  def: "TINYINT(1) NOT NULL DEFAULT 0" },
  // etiqueta_templates — textos
  { table: 'etiqueta_templates', column: 'texto_fecha_emision',     def: "VARCHAR(100) NULL COMMENT 'Label Fecha emisión en header'" },
  { table: 'etiqueta_templates', column: 'texto_etiqueta',          def: "VARCHAR(50) NULL COMMENT 'Label Etiqueta (contador X/Y)'" },
  { table: 'etiqueta_templates', column: 'texto_entregar_a',        def: "VARCHAR(100) NULL COMMENT 'Label sección Entregar a:'" },
  { table: 'etiqueta_templates', column: 'texto_peso',              def: "VARCHAR(50) NULL COMMENT 'Label campo Peso'" },
  { table: 'etiqueta_templates', column: 'texto_entrega_estimada',  def: "VARCHAR(100) NULL COMMENT 'Label campo Entrega estimada'" },
  { table: 'etiqueta_templates', column: 'texto_ref_cliente',       def: "VARCHAR(100) NULL COMMENT 'Label campo Ref. cliente'" },
  { table: 'etiqueta_templates', column: 'texto_descripcion',       def: "VARCHAR(100) NULL COMMENT 'Label sección Descripción / Contenido'" },

  // historial_estados
  { table: 'historial_estados', column: 'foto_evidencia', def: 'VARCHAR(255) DEFAULT NULL' },
];

// ─── Tablas nuevas a crear si no existen ───────────────────
const NEW_TABLES = [
  {
    name: 'pictogramas',
    sql: `CREATE TABLE IF NOT EXISTS \`pictogramas\` (
      \`id\`         INT           NOT NULL AUTO_INCREMENT,
      \`nombre\`     VARCHAR(100)  NOT NULL,
      \`imagen_url\` VARCHAR(500)  NOT NULL COMMENT 'Ruta pública ej: /uploads/pictogramas/hazmat.png',
      \`orden\`      INT           NOT NULL DEFAULT 0,
      \`activo\`     TINYINT(1)    NOT NULL DEFAULT 1,
      \`creado_en\`  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'envio_pictogramas',
    sql: `CREATE TABLE IF NOT EXISTS \`envio_pictogramas\` (
      \`envio_id\`      INT NOT NULL,
      \`pictograma_id\` INT NOT NULL,
      PRIMARY KEY (\`envio_id\`, \`pictograma_id\`),
      KEY \`fk_ep_picto_idx\` (\`pictograma_id\`),
      CONSTRAINT \`fk_ep_envio\`  FOREIGN KEY (\`envio_id\`)      REFERENCES \`envios\`      (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_ep_picto\`  FOREIGN KEY (\`pictograma_id\`) REFERENCES \`pictogramas\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  }
];

// ─── Helper ─────────────────────────────────────────────────
async function getExistingColumns(conn, dbName) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME, COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?`,
    [dbName]
  );
  const map = {};
  for (const r of rows) {
    if (!map[r.TABLE_NAME]) map[r.TABLE_NAME] = new Set();
    map[r.TABLE_NAME].add(r.COLUMN_NAME);
  }
  return map;
}

async function getExistingTables(conn, dbName) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?`,
    [dbName]
  );
  return new Set(rows.map(r => r.TABLE_NAME));
}

async function syncDB(label, config) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Sincronizando: ${label} (${config.database}@${config.host})`);
  console.log(`${'═'.repeat(60)}`);

  const conn = await mysql.createConnection(config);
  const dbName = config.database;

  const existingCols   = await getExistingColumns(conn, dbName);
  const existingTables = await getExistingTables(conn, dbName);

  let changes = 0;

  // 1. Crear tablas nuevas
  for (const t of NEW_TABLES) {
    if (!existingTables.has(t.name)) {
      console.log(`  [+] CREATE TABLE ${t.name}`);
      await conn.query(t.sql);
      changes++;
    } else {
      console.log(`  [✓] TABLE ${t.name} ya existe`);
    }
  }

  // 2. Agregar columnas faltantes
  for (const { table, column, def } of EXPECTED_COLUMNS) {
    const cols = existingCols[table];
    if (!cols) {
      console.log(`  [!] Tabla ${table} no encontrada — se omite columna ${column}`);
      continue;
    }
    if (!cols.has(column)) {
      const sql = `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def}`;
      console.log(`  [+] ADD COLUMN ${table}.${column}`);
      try {
        await conn.query(sql);
        changes++;
      } catch (e) {
        console.log(`      ERROR: ${e.message}`);
      }
    } else {
      console.log(`  [✓] ${table}.${column}`);
    }
  }

  await conn.end();
  console.log(`\n  Total cambios aplicados: ${changes}`);
}

// ─── Main ───────────────────────────────────────────────────
(async () => {
  try {
    await syncDB('LOCAL', LOCAL);
    await syncDB('RAILWAY', RAILWAY);
    console.log('\n✅ Sincronización completada.\n');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
})();
