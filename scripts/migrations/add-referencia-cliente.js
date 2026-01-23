const db = require('../config/database');

async function migrate() {
  try {
    // Primero verificamos si la columna ya existe
    const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'envios' 
        AND COLUMN_NAME = 'referencia_cliente'
    `);

    if (columns.length > 0) {
      console.log('ℹ️  La columna referencia_cliente ya existe');
      process.exit(0);
      return;
    }

    // Si no existe, la agregamos
    await db.query(`
      ALTER TABLE envios 
      ADD COLUMN referencia_cliente VARCHAR(100) NULL 
      AFTER numero_tracking
    `);
    
    console.log('✅ Columna referencia_cliente agregada correctamente');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Detalles:', error);
  } finally {
    process.exit(0);
  }
}

migrate();