const db = require('./config/database');

async function testConnection() {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    console.log('✅ Conexión exitosa a la base de datos Railway!');
    console.log('Resultado de prueba:', rows[0].result);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al conectar:', error.message);
    process.exit(1);
  }
}

testConnection();