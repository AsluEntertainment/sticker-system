require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const fs = require('fs');
const path = require('path');

// ─── Cloudinary config ─────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── App ────────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // CORS abierto para cualquier origen
app.use(express.json());

// ─── colecciones.json ───────────────────────────────────────────────────────
const COLECCIONES_PATH = path.join(__dirname, 'colecciones.json');

function leerColecciones() {
  const raw = fs.readFileSync(COLECCIONES_PATH, 'utf-8');
  return JSON.parse(raw);
}

function escribirColecciones(data) {
  fs.writeFileSync(COLECCIONES_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Multer + Cloudinary Storage ────────────────────────────────────────────
// El storage se crea dinámicamente por colección (see POST endpoint).
function crearStorage(coleccionId) {
  return new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `sticker-system/${coleccionId}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      resource_type: 'image',
    },
  });
}

// ─── GET /api/colecciones ────────────────────────────────────────────────────
// Lista todas las colecciones con sus imágenes desde Cloudinary.
app.get('/api/colecciones', async (req, res) => {
  try {
    const colecciones = leerColecciones();
    const ids = Object.keys(colecciones);

    const resultados = await Promise.all(
      ids.map(async (id) => {
        const folder = `sticker-system/${id}`;
        let imagenes = [];

        try {
          // Obtener recursos de la carpeta en Cloudinary
          const response = await cloudinary.api.resources({
            type: 'upload',
            prefix: folder,
            max_results: 500,
          });

          imagenes = (response.resources || []).map((r) => ({
            url:       r.secure_url,
            public_id: r.public_id,
          }));
        } catch (err) {
          // Si la carpeta no existe aún en Cloudinary, retornamos vacío
          console.warn(`Sin imágenes para ${folder}:`, err.message);
        }

        return {
          id,
          nombre: colecciones[id],
          imagenes,
        };
      })
    );

    res.json(resultados);
  } catch (err) {
    console.error('Error al listar colecciones:', err);
    res.status(500).json({ error: 'Error interno al listar colecciones.' });
  }
});

// ─── POST /api/colecciones/:id/imagenes ─────────────────────────────────────
// Sube una imagen a la carpeta de la colección en Cloudinary.
app.post('/api/colecciones/:id/imagenes', (req, res) => {
  const { id } = req.params;
  const colecciones = leerColecciones();

  if (!colecciones[id]) {
    return res.status(404).json({ error: `Colección '${id}' no encontrada.` });
  }

  const storage = crearStorage(id);
  const upload  = multer({ storage }).single('imagen');

  upload(req, res, (err) => {
    if (err) {
      console.error('Error al subir imagen:', err);
      return res.status(500).json({ error: 'Error al subir la imagen.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }

    res.status(201).json({
      url:       req.file.path,        // secure_url provisto por multer-storage-cloudinary
      public_id: req.file.filename,    // public_id provisto por multer-storage-cloudinary
    });
  });
});

// ─── PUT /api/colecciones/:id/nombre ─────────────────────────────────────────
// Cambia el nombre (display name) de una colección en colecciones.json.
app.put('/api/colecciones/:id/nombre', (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;

  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
    return res.status(400).json({ error: 'El campo "nombre" es obligatorio.' });
  }

  const colecciones = leerColecciones();

  if (!colecciones[id]) {
    return res.status(404).json({ error: `Colección '${id}' no encontrada.` });
  }

  colecciones[id] = nombre.trim();
  escribirColecciones(colecciones);

  res.json({ id, nombre: colecciones[id] });
});

// ─── DELETE /api/colecciones/:id/imagenes/:public_id ──────────────────────
// Elimina una imagen de Cloudinary por su public_id.
// El public_id puede contener barras "/" → se recibe como wildcard.
app.delete('/api/colecciones/:id/imagenes/*', async (req, res) => {
  const { id } = req.params;
  // req.params[0] contiene el resto de la ruta después de "imagenes/"
  const public_id = req.params[0];

  if (!public_id) {
    return res.status(400).json({ error: 'Se requiere el public_id de la imagen.' });
  }

  const colecciones = leerColecciones();
  if (!colecciones[id]) {
    return res.status(404).json({ error: `Colección '${id}' no encontrada.` });
  }

  try {
    const result = await cloudinary.uploader.destroy(public_id);

    if (result.result !== 'ok' && result.result !== 'not found') {
      return res.status(500).json({ error: 'No se pudo eliminar la imagen.', detail: result });
    }

    res.json({ message: 'Imagen eliminada correctamente.', public_id, result: result.result });
  } catch (err) {
    console.error('Error al eliminar imagen:', err);
    res.status(500).json({ error: 'Error interno al eliminar la imagen.' });
  }
});

// ─── Healthcheck ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Sticker System API running.' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en el puerto ${PORT}`);
});
