-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol ENUM('admin', 'operador', 'cliente') DEFAULT 'operador',
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre_empresa VARCHAR(150) NOT NULL,
  contacto VARCHAR(100),
  telefono VARCHAR(20),
  email VARCHAR(100),
  direccion TEXT,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de envíos
CREATE TABLE IF NOT EXISTS envios (
  id INT PRIMARY KEY AUTO_INCREMENT,
  numero_tracking VARCHAR(50) UNIQUE NOT NULL,
  cliente_id INT,
  origen VARCHAR(200) NOT NULL,
  destino VARCHAR(200) NOT NULL,
  descripcion TEXT,
  peso DECIMAL(10,2),
  estado_actual VARCHAR(50) DEFAULT 'creado',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_estimada_entrega DATE,
  usuario_creador_id INT,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (usuario_creador_id) REFERENCES usuarios(id)
);

-- Tabla de historial de estados
CREATE TABLE IF NOT EXISTS historial_estados (
  id INT PRIMARY KEY AUTO_INCREMENT,
  envio_id INT NOT NULL,
  estado VARCHAR(50) NOT NULL,
  ubicacion VARCHAR(200),
  comentarios TEXT,
  foto_evidencia VARCHAR(255),
  fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  usuario_id INT,
  FOREIGN KEY (envio_id) REFERENCES envios(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);