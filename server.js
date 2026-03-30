require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const multer     = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { createClient } = require('@supabase/supabase-js');

// ─── Supabase ────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ─── Cloudinary config ───────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── App ─────────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Colecciones por defecto ─────────────────────────────────────────────────
const COLECCIONES_DEFAULT = [
  { id: 'coleccion_a', nombre: 'Colección A' },
  { id: 'coleccion_b', nombre: 'Colección B' },
  { id: 'coleccion_c', nombre: 'Colección C' },
  { id: 'coleccion_d', nombre: 'Colección D' },
  { id: 'coleccion_e', nombre: 'Colección E' },
  { id: 'coleccion_f', nombre: 'Colección F' },
];

// ─── Multer + Cloudinary Storage ─────────────────────────────────────────────
function crearStorage(coleccionId) {
  return new CloudinaryStorage({
    cloudinary,
    params: {
      folder:          `sticker-system/${coleccionId}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      resource_type:   'image',
    },
  });
}

// ─── GET /api/colecciones ────────────────────────────────────────────────────
// Lista todas las colecciones con sus imágenes desde Cloudinary.
app.get('/api/colecciones', async (req, res) => {
  try {
    let { data: colecciones, error } = await supabase
      .from('colecciones')
      .select('*');

    if (error) throw error;

    // Si la tabla está vacía, insertar las 6 por defecto
    if (!colecciones || colecciones.length === 0) {
      const { data: insertadas, error: insertError } = await supabase
        .from('colecciones')
        .insert(COLECCIONES_DEFAULT)
        .select();

      if (insertError) throw insertError;
      colecciones = insertadas;
      console.log('📦 Colecciones por defecto insertadas en Supabase.');
    }

    // Combinar cada colección con sus imágenes de Cloudinary
    const resultados = await Promise.all(
      colecciones.map(async (col) => {
        const folder = `sticker-system/${col.id}`;
        let imagenes = [];

        try {
          const response = await cloudinary.api.resources({
            type:        'upload',
            prefix:      folder,
            max_results: 500,
          });

          imagenes = (response.resources || []).map((r) => ({
            url:       r.secure_url,
            public_id: r.public_id,
          }));
        } catch (err) {
          console.warn(`Sin imágenes para ${folder}:`, err.message);
        }

        return {
          id:       col.id,
          nombre:   col.nombre,
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

// ─── POST /api/colecciones ───────────────────────────────────────────────────
app.post('/api/colecciones', async (req, res) => {
  const { id, nombre } = req.body;

  if (!id || !nombre) {
    return res.status(400).json({ error: 'Faltan datos: se requieren id y nombre.' });
  }

  try {
    // Verificar si ya existe
    const { data: existente } = await supabase
      .from('colecciones')
      .select('id')
      .eq('id', id)
      .single();

    if (existente) {
      return res.status(400).json({ error: 'La colección ya existe.' });
    }

    // Insertar nueva colección
    const { data: nueva, error } = await supabase
      .from('colecciones')
      .insert({ id, nombre })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ id: nueva.id, nombre: nueva.nombre });
  } catch (err) {
    console.error('Error al crear colección:', err);
    res.status(500).json({ error: 'Error interno al crear la colección.' });
  }
});

// ─── POST /api/colecciones/:id/imagenes ─────────────────────────────────────
// Sube una imagen a la carpeta de la colección en Cloudinary.
app.post('/api/colecciones/:id/imagenes', async (req, res) => {
  const { id } = req.params;

  try {
    const { data: col, error } = await supabase
      .from('colecciones')
      .select('id')
      .eq('id', id)
      .single();

    if (error || !col) {
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
        url:       req.file.path,
        public_id: req.file.filename,
      });
    });
  } catch (err) {
    console.error('Error al buscar colección:', err);
    res.status(500).json({ error: 'Error interno.' });
  }
});

// ─── PUT /api/colecciones/:id/nombre ─────────────────────────────────────────
// Cambia el nombre de una colección en Supabase.
app.put('/api/colecciones/:id/nombre', async (req, res) => {
  const { id }     = req.params;
  const { nombre } = req.body;

  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
    return res.status(400).json({ error: 'El campo "nombre" es obligatorio.' });
  }

  try {
    // Actualizar nombre
    const { data: col, error } = await supabase
      .from('colecciones')
      .update({ nombre: nombre.trim() })
      .eq('id', id)
      .select()
      .single();

    if (error || !col) {
      return res.status(404).json({ error: `Colección '${id}' no encontrada.` });
    }

    res.json({ id: col.id, nombre: col.nombre });
  } catch (err) {
    console.error('Error al actualizar colección:', err);
    res.status(500).json({ error: 'Error interno al actualizar la colección.' });
  }
});

// ─── DELETE /api/colecciones/:id ─────────────────────────────────────────────
// Elimina la colección de Supabase y todas sus imágenes de Cloudinary.
app.delete('/api/colecciones/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar que existe
    const { data: col, error: findError } = await supabase
      .from('colecciones')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !col) {
      return res.status(404).json({ error: `Colección '${id}' no encontrada.` });
    }

    // 1️⃣ Eliminar todas las imágenes de Cloudinary
    const folder = `sticker-system/${id}`;
    try {
      const response = await cloudinary.api.resources({
        type:        'upload',
        prefix:      folder,
        max_results: 500,
      });

      const publicIds = (response.resources || []).map((r) => r.public_id);

      if (publicIds.length > 0) {
        await cloudinary.api.delete_resources(publicIds);
        console.log(`🗑️  ${publicIds.length} imágenes eliminadas de Cloudinary (${folder})`);
      }
    } catch (cloudErr) {
      console.warn(`Sin imágenes en Cloudinary para ${folder}:`, cloudErr.message);
    }

    // 2️⃣ Eliminar de Supabase
    const { error: deleteError } = await supabase
      .from('colecciones')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.json({ message: `Colección '${id}' eliminada correctamente.` });
  } catch (err) {
    console.error('Error al eliminar colección:', err);
    res.status(500).json({ error: 'Error interno al eliminar la colección.' });
  }
});

// ─── DELETE /api/colecciones/:id/imagenes/:public_id ──────────────────────
// Elimina una imagen individual de Cloudinary por su public_id.
app.delete('/api/colecciones/:id/imagenes/*', async (req, res) => {
  const { id }    = req.params;
  const public_id = req.params[0];

  if (!public_id) {
    return res.status(400).json({ error: 'Se requiere el public_id de la imagen.' });
  }

  try {
    const { data: col, error } = await supabase
      .from('colecciones')
      .select('id')
      .eq('id', id)
      .single();

    if (error || !col) {
      return res.status(404).json({ error: `Colección '${id}' no encontrada.` });
    }

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

// ─── Healthcheck ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Sticker System API running.' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('Supabase conectado');
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
