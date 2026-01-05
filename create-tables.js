const db = require('./config/database');
const fs = require('fs');
const bcrypt = require('bcryptjs');

async function createTables() {
  try {
    console.log('📊 Creando tablas en la base de datos Railway...\n');

    // Leer el archivo SQL
    const sql = fs.readFileSync('./database/schema.sql', 'utf8');
    
    // Dividir las queries por punto y coma y filtrar vacías
    const queries = sql
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0);

    // Ejecutar cada query
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      try {
        await db.query(query);
        console.log(`✅ Tabla ${i + 1} creada/verificada`);
      } catch (err) {
        console.log(`⚠️  Tabla ${i + 1}: ${err.message}`);
      }
    }

    // Crear usuario administrador
    console.log('\n👤 Creando usuario administrador...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    try {
      await db.query(
        'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
        ['Administrador', 'admin@tracking.com', hashedPassword, 'admin']
      );
      console.log('✅ Usuario admin creado exitosamente');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        console.log('✅ Usuario admin ya existe');
      } else {
        console.log('⚠️  Error creando usuario admin:', err.message);
      }
    }

    console.log('\n🎉 ¡Base de datos lista!\n');
    console.log('📋 Tablas creadas:');
    console.log('   ✓ usuarios');
    console.log('   ✓ clientes');
    console.log('   ✓ envios');
    console.log('   ✓ historial_estados\n');
    console.log('🔐 Credenciales de acceso:');
    console.log('   Email: admin@tracking.com');
    console.log('   Password: admin123\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error general:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createTables();