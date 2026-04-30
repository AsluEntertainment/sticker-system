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
          id:                col.id,
          nombre:            col.nombre,
          pdf_url:           col.pdf_url,
          cantidad_stickers: col.cantidad_stickers ?? 0,
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

// ─── PUT /api/colecciones/:id/pdf ────────────────────────────────────────────
// Vincula o desvincula un PDF de Google Drive.
app.put('/api/colecciones/:id/pdf', async (req, res) => {
  const { id }      = req.params;
  const { pdf_url } = req.body;

  try {
    const { data: col, error } = await supabase
      .from('colecciones')
      .update({ pdf_url: pdf_url || null })
      .eq('id', id)
      .select()
      .single();

    if (error || !col) {
      return res.status(404).json({ error: `Colección '${id}' no encontrada.` });
    }

    res.json({ id: col.id, pdf_url: col.pdf_url });
  } catch (err) {
    console.error('Error al actualizar PDF de la colección:', err);
    res.status(500).json({ error: 'Error interno al actualizar el PDF.' });
  }
});

// ─── POST /api/colecciones/update-qty ────────────────────────────────────────
// Actualiza la cantidad de stickers de una colección.
app.post('/api/colecciones/update-qty', async (req, res) => {
  console.log('--- Petición Qty recibida:', req.body);
  const { id, nueva_cantidad } = req.body;

  if (!id || nueva_cantidad === undefined || nueva_cantidad === null) {
    return res.status(400).json({ error: 'Faltan datos: se requieren id y nueva_cantidad.' });
  }

  const qty = parseInt(nueva_cantidad, 10);
  if (isNaN(qty) || qty < 0) {
    return res.status(400).json({ error: 'nueva_cantidad debe ser un número entero no negativo.' });
  }

  try {
    const { data: col, error } = await supabase
      .from('colecciones')
      .update({ cantidad_stickers: qty })
      .eq('id', id)
      .select()
      .single();

    if (error || !col) {
      return res.status(404).json({ error: `Colección '${id}' no encontrada.` });
    }

    res.json({ id: col.id, cantidad_stickers: col.cantidad_stickers });
  } catch (err) {
    console.error('Error al actualizar cantidad de stickers:', err);
    res.status(500).json({ error: 'Error interno al actualizar la cantidad.' });
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

// ─── GET /api/pedidos ────────────────────────────────────────────────────────
// Opcional query param: ?estado=completado,entregado
// Retorna todos los pedidos ordenados por creado_en desc
// Incluye sus colecciones de pedido_colecciones
app.get('/api/pedidos', async (req, res) => {
  try {
    let query = supabase
      .from('pedidos')
      .select(`*, pedido_colecciones(*)`)
      .order('creado_en', { ascending: false });

    if (req.query.estado) {
      const estados = req.query.estado.split(',');
      query = query.in('estado', estados);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Error al listar pedidos:', err);
    res.status(500).json({ error: 'Error interno al listar pedidos.' });
  }
});

// ─── GET /api/pedidos/exportar ──────────────────────────────────────────────
// Exporta pedidos de un mes como CSV. Query param: ?mes=2026-03
app.get('/api/pedidos/exportar', async (req, res) => {
  const { mes } = req.query;

  try {
    let query = supabase
      .from('pedidos')
      .select(`*, pedido_colecciones(*)`)
      .order('creado_en', { ascending: true });

    if (mes) {
      // Filtrar por mes: creado_en entre inicio y fin del mes
      const [anio, mesNum] = mes.split('-').map(Number);
      const inicio = new Date(anio, mesNum - 1, 1).toISOString();
      const fin    = new Date(anio, mesNum, 1).toISOString();
      query = query.gte('creado_en', inicio).lt('creado_en', fin);
    }

    const { data: pedidos, error } = await query;
    if (error) throw error;

    // Obtener nombres de colecciones
    const { data: colecciones } = await supabase.from('colecciones').select('id, nombre');
    const colMap = {};
    (colecciones || []).forEach(c => { colMap[c.id] = c.nombre; });

    // Cabecera CSV
    const filas = [
      'ID,Receptor,Numero Entrega,Colecciones,Total Stickers,Fecha Creacion,Fecha Entrega,Estado,Tiempo Produccion (hrs),Zona,Slot'
    ];

    for (const p of (pedidos || [])) {
      // Colecciones: "Nombre:cantidad|Nombre:cantidad"
      const colStr = (p.pedido_colecciones || [])
        .map(c => `${colMap[c.coleccion_id] || c.coleccion_id}:${c.cantidad}`)
        .join('|');

      const totalStickers = (p.pedido_colecciones || []).reduce((s, c) => s + (c.cantidad || 0), 0);

      // Tiempo de producción
      let tiempoHrs = '';
      if (p.inicio_produccion && p.fin_produccion) {
        const diff = (new Date(p.fin_produccion) - new Date(p.inicio_produccion)) / (1000 * 60 * 60);
        tiempoHrs = diff.toFixed(2);
      }

      const fechaCreacion = p.creado_en ? p.creado_en.split('T')[0] : '';
      const fechaEntrega  = p.fecha_entrega || '';

      // Escapar comillas en colStr por si contiene comas
      filas.push(
        `${p.id},${p.nombre_receptor},${p.numero_entrega},"${colStr}",${totalStickers},${fechaCreacion},${fechaEntrega},${p.estado},${tiempoHrs},${p.zona_produccion || ''},${p.slot_almacen || ''}`
      );
    }

    const nombreArchivo = mes ? `pedidos-${mes}.csv` : 'pedidos.csv';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.send(filas.join('\n'));
  } catch (err) {
    console.error('Error al exportar pedidos:', err);
    res.status(500).json({ error: 'Error interno al exportar pedidos.' });
  }
});

// ─── GET /api/pedidos/:id ────────────────────────────────────────────────────
// Obtiene un pedido específico
app.get('/api/pedidos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('pedidos')
      .select(`*, pedido_colecciones(*)`)
      .eq('id', id)
      .single();

    if (error) {
       return res.status(404).json({ error: `Pedido '${id}' no encontrado.` });
    }
    res.json(data);
  } catch (err) {
    console.error('Error al obtener pedido:', err);
    res.status(500).json({ error: 'Error interno al obtener el pedido.' });
  }
});

// ─── POST /api/pedidos ───────────────────────────────────────────────────────
// Crea nuevo pedido
app.post('/api/pedidos', async (req, res) => {
  console.log('📥 Datos recibidos en el servidor:', req.body);
  const { 
    cliente, numero_pedido, fecha_entrega, items,
    numero_entrega, zona_produccion, slot_almacen, total_stickers, id
  } = req.body;
  const finalId = id || numero_pedido || Date.now().toString();

  try {
    const { data: existente } = await supabase
      .from('pedidos')
      .select('id')
      .eq('id', finalId)
      .maybeSingle();

    if (existente) {
      return res.status(400).json({ error: 'El pedido ya existe' });
    }

    // ── Validación estricta de total_stickers ──
    const rawStickers = req.body.total_stickers;
    console.log('🔍 total_stickers recibido:', rawStickers, '| Tipo:', typeof rawStickers);
    
    let stickersFinal = parseInt(rawStickers, 10);
    if (isNaN(stickersFinal) || stickersFinal === undefined || stickersFinal === null) {
      console.warn('⚠️ total_stickers llegó vacío/inválido. Asignando 999 como valor de prueba.');
      stickersFinal = 999; // Valor centinela para diagnóstico — si ves 999 en Supabase, el frontend NO envió nada
    }
    console.log('✅ total_stickers final a insertar:', stickersFinal);

    // 1. Insertar en tabla pedidos con las columnas exactas
    const { data: nuevo, error: errorPedido } = await supabase
      .from('pedidos')
      .insert({
        id: finalId,
        nombre_receptor: cliente,
        fecha_entrega: fecha_entrega,
        fecha_impresion: new Date().toISOString(),
        estado: 'completado',
        inicio_produccion: new Date().toISOString(),
        fin_produccion: new Date().toISOString(),
        numero_entrega,
        zona_produccion,
        slot_almacen,
        total_stickers: stickersFinal
      })
      .select()
      .single();

    if (errorPedido) throw errorPedido;

    // 2. Insertar cada colección (items) en pedido_colecciones
    if (items && items.length > 0) {
      const coleccionesParaInsertar = items.map((c, idx) => ({
        pedido_id: finalId,
        coleccion_id: c.coleccion_id,
        cantidad: c.cantidad || 1,
        orden: c.orden || (idx + 1),
        conteo_actual: 0
      }));

      const { error: errorColecciones } = await supabase
        .from('pedido_colecciones')
        .insert(coleccionesParaInsertar);

      if (errorColecciones) {
        console.error('Error al insertar colecciones del pedido:', errorColecciones);
      }
    }
    
    // 3. Retornar pedido completo con status 201
    const { data: pedidoCompleto, error: errorCompleto } = await supabase
      .from('pedidos')
      .select(`*, pedido_colecciones(*)`)
      .eq('id', finalId)
      .single();
      
    res.status(201).json(pedidoCompleto || nuevo);
  } catch (err) {
    console.error('Error al crear pedido:', err);
    res.status(500).json({ error: 'Error interno al crear el pedido.' });
  }
});

// ─── PUT /api/pedidos/:id/estado ─────────────────────────────────────────────
// Actualiza estado del pedido
app.put('/api/pedidos/:id/estado', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
    const updateData = { estado };

    if (estado === 'en_proceso') {
      updateData.inicio_produccion = new Date().toISOString();
    } else if (estado === 'completado') {
      updateData.fin_produccion = new Date().toISOString();
    }

    const { data: pedido, error } = await supabase
      .from('pedidos')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !pedido) {
      return res.status(404).json({ error: `Pedido '${id}' no encontrado.` });
    }
    res.json(pedido);
  } catch (err) {
    console.error('Error al actualizar estado del pedido:', err);
    res.status(500).json({ error: 'Error interno al actualizar estado.' });
  }
});


// ─── PUT /api/pedidos/:id/conteo ─────────────────────────────────────────────
// Incrementa conteo de stickers
app.put('/api/pedidos/:id/conteo', async (req, res) => {
  const { id } = req.params;
  const { coleccion_id } = req.body;

  try {
    const { data: currentItem, error: fetchError } = await supabase
      .from('pedido_colecciones')
      .select('conteo_actual')
      .eq('pedido_id', id)
      .eq('coleccion_id', coleccion_id)
      .single();

    if (fetchError || !currentItem) {
      return res.status(404).json({ error: 'Colección de pedido no encontrada.' });
    }

    const { data, error } = await supabase
      .from('pedido_colecciones')
      .update({ conteo_actual: currentItem.conteo_actual + 1 })
      .eq('pedido_id', id)
      .eq('coleccion_id', coleccion_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error al incrementar conteo:', err);
    res.status(500).json({ error: 'Error interno al incrementar conteo.' });
  }
});

// ─── PUT /api/pedidos/:id/slot ───────────────────────────────────────────────
// Actualiza slot de almacén
app.put('/api/pedidos/:id/slot', async (req, res) => {
  const { id } = req.params;
  const { slot_almacen } = req.body;

  try {
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .update({ slot_almacen })
      .eq('id', id)
      .select()
      .single();

    if (error || !pedido) {
      return res.status(404).json({ error: `Pedido '${id}' no encontrado.` });
    }
    res.json(pedido);
  } catch (err) {
    console.error('Error al actualizar slot del pedido:', err);
    res.status(500).json({ error: 'Error interno al actualizar slot.' });
  }
});

// ─── DELETE /api/pedidos/mes ───────────────────────────────────────────────────
// Elimina todos los pedidos de un mes
app.delete('/api/pedidos/mes', async (req, res) => {
  const { mes } = req.query;
  if (!mes) return res.status(400).json({ error: 'Falta mes' });
  try {
    const [anio, mesNum] = mes.split('-').map(Number);
    const inicio = new Date(anio, mesNum - 1, 1).toISOString();
    const fin = new Date(anio, mesNum, 1).toISOString();
    
    // 1. Obtener IDs de pedidos del mes
    const { data: pedidos, error: err1 } = await supabase
      .from('pedidos')
      .select('id')
      .gte('creado_en', inicio)
      .lt('creado_en', fin);
      
    if (err1) throw err1;
    if (!pedidos || pedidos.length === 0) return res.json({ message: 'No hay pedidos en este mes' });

    const ids = pedidos.map(p => p.id);

    // 2. Eliminar pedido_colecciones
    const { error: err2 } = await supabase.from('pedido_colecciones').delete().in('pedido_id', ids);
    if (err2) throw err2;

    // 3. Eliminar pedidos
    const { error: err3 } = await supabase.from('pedidos').delete().in('id', ids);
    if (err3) throw err3;

    res.json({ message: `Pedidos del mes ${mes} eliminados con éxito.` });
  } catch(err) {
    console.error('Error eliminando mes:', err);
    res.status(500).json({ error: 'Error al eliminar pedidos del mes' });
  }
});

// ─── DELETE /api/pedidos/:id ─────────────────────────────────────────────────
// Elimina pedido
app.delete('/api/pedidos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Eliminar colecciones del pedido en pedido_colecciones
    await supabase.from('pedido_colecciones').delete().eq('pedido_id', id);

    // 2. Eliminar pedido
    const { error: errorPedido } = await supabase.from('pedidos').delete().eq('id', id);
    if (errorPedido) throw errorPedido;

    res.json({ message: `Pedido '${id}' eliminado correctamente.` });
  } catch (err) {
    console.error('Error al eliminar pedido:', err);
    res.status(500).json({ error: 'Error interno al eliminar pedido.' });
  }
});

// ─── GET /api/pedidos/:id/colecciones ────────────────────────────────────────
// Lista colecciones de un pedido
app.get('/api/pedidos/:id/colecciones', async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('pedido_colecciones')
      .select('*')
      .eq('pedido_id', id)
      .order('orden', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error al listar colecciones del pedido:', err);
    res.status(500).json({ error: 'Error interno al listar colecciones.' });
  }
});

// ─── GET /api/stats ──────────────────────────────────────────────────────────
// Query param: ?periodo=semana|mes|todo (default: todo)
app.get('/api/stats', async (req, res) => {
  const periodo = req.query.periodo || 'todo';

  try {
    // ── Filtro de fecha ───────────────────────────────────────────────────────
    const ahora = new Date();
    let fechaDesde = null;

    if (periodo === 'semana') {
      fechaDesde = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (periodo === 'mes') {
      fechaDesde = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    // ── Consulta de pedidos con sus colecciones ───────────────────────────────
    let query = supabase
      .from('pedidos')
      .select('*, pedido_colecciones(*)')
      .order('creado_en', { ascending: true });

    // Filtrar por creado_en (columna que sí existe en la tabla pedidos)
    if (fechaDesde) {
      query = query.gte('creado_en', fechaDesde);
    }

    const { data: pedidos, error: errorPedidos } = await query;
    if (errorPedidos) throw errorPedidos;

    // ── Colección Maestra: leer nombres y cantidad_stickers de tabla 'colecciones' ──
    const { data: masterCols, error: errorCol } = await supabase
      .from('colecciones')
      .select('id, nombre, cantidad_stickers');
    if (errorCol) console.error('Error al cargar colecciones maestras:', errorCol);

    const colMap = {};
    (masterCols || []).forEach(c => { 
      colMap[c.id] = { nombre: c.nombre, stickers: parseInt(c.cantidad_stickers, 10) || 0 }; 
    });
    console.log('📊 [Stats] Colección Maestra cargada:', JSON.stringify(colMap));

    // ── Totales generales ─────────────────────────────────────────────────────
    const listaPedidos  = pedidos || [];
    let totalStickers   = 0;
    let pedidosCompletados = 0;
    let pedidosPendientes  = 0;
    const tiemposProduccion = [];
    const conteoColecciones = {};
    const nombresColecciones = {};

    // Procesar pedidos
    listaPedidos.forEach(p => {
      let stickersPedido = 0;
      if (p.pedido_colecciones) {
        p.pedido_colecciones.forEach(c => {
          const info = colMap[c.coleccion_id] || { nombre: c.coleccion_id, stickers: 0 };
          if (!conteoColecciones[c.coleccion_id]) {
            conteoColecciones[c.coleccion_id] = 0;
            nombresColecciones[c.coleccion_id] = info.nombre;
          }
          const subtotal = (parseInt(c.cantidad) || 0) * info.stickers;
          conteoColecciones[c.coleccion_id] += subtotal;
          stickersPedido += subtotal;
        });
      }

      totalStickers += stickersPedido;

      if (p.estado === 'completado' || p.estado === 'entregado') {
        pedidosCompletados++;
      } else {
        pedidosPendientes++;
      }

      // Tiempos de producción
      if (p.fin_produccion) {
        const inicioOCreado = p.inicio_produccion || p.creado_en;
        if (inicioOCreado) {
          const tiempoHrs = (new Date(p.fin_produccion) - new Date(inicioOCreado)) / (1000 * 60 * 60);
          tiemposProduccion.push({
            pedido_id:        p.id,
            tiempo_horas:     Math.round(tiempoHrs * 100) / 100,
            cantidad_stickers: stickersPedido,
            fecha:            p.creado_en
          });
        }
      }
    });

    console.log('📊 [Stats] totalStickers calculado:', totalStickers);
    console.log('📊 [Stats] conteoColecciones:', JSON.stringify(conteoColecciones));

    // ── Tiempo promedio ───────────────────────────────────────────────────────
    const tiempoPromedioHoras = tiemposProduccion.length > 0
      ? Math.round((tiemposProduccion.reduce((s, t) => s + t.tiempo_horas, 0) / tiemposProduccion.length) * 100) / 100
      : 0;

    // ── Por colección (Pareto) ────────────────────────────────────────────────
    const totalColecciones = Object.values(conteoColecciones).reduce((s, v) => s + v, 0) || 1;
    const porColeccion = Object.entries(conteoColecciones)
      .map(([coleccion_id, cantidad]) => ({
        coleccion_id,
        nombre:      nombresColecciones[coleccion_id] || coleccion_id,
        cantidad
      }))
      .sort((a, b) => b.cantidad - a.cantidad);

    let acumulado = 0;
    const porColeccionConAcumulado = porColeccion.map(item => {
      const porcentaje = Math.round((item.cantidad / totalColecciones) * 1000) / 10;
      acumulado += porcentaje;
      return {
        ...item,
        stickers: item.cantidad,
        porcentaje,
        porcentaje_acumulado: Math.round(acumulado * 10) / 10
      };
    });

    // ── Por semana (últimas 8 semanas) ────────────────────────────────────────
    const porSemana = [];
    for (let i = 7; i >= 0; i--) {
      const inicioSem = new Date(ahora);
      inicioSem.setDate(ahora.getDate() - i * 7 - 6);
      inicioSem.setHours(0, 0, 0, 0);
      const finSem = new Date(inicioSem);
      finSem.setDate(inicioSem.getDate() + 7);

      const pedidosSem = listaPedidos.filter(p => {
        const d = new Date(p.creado_en);
        return d >= inicioSem && d < finSem;
      });

      // Calcular stickers de la semana desde pedido_colecciones × colecciones
      let stickersSem = 0;
      for (const p of pedidosSem) {
        for (const c of (p.pedido_colecciones || [])) {
          const unidades = parseInt(c.cantidad, 10) || 0;
          const factor = (colMap[c.coleccion_id] && colMap[c.coleccion_id].cantidad_stickers) || 0;
          stickersSem += unidades * factor;
        }
      }

      porSemana.push({
        semana:       `Sem ${8 - i}`,
        fecha_inicio: inicioSem.toISOString().split('T')[0],
        pedidos:      pedidosSem.length,
        stickers:     stickersSem
      });
    }

    // ── Por mes (últimos 6 meses) ─────────────────────────────────────────────
    const porMes = [];
    for (let i = 5; i >= 0; i--) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const anoMes  = fecha.getFullYear();
      const mesNum  = fecha.getMonth();
      const inicioM = new Date(anoMes, mesNum, 1);
      const finM    = new Date(anoMes, mesNum + 1, 1);

      const pedidosMes = listaPedidos.filter(p => {
        const d = new Date(p.creado_en);
        return d >= inicioM && d < finM;
      });

      // Calcular stickers del mes desde pedido_colecciones × colecciones
      let stickersMes = 0;
      for (const p of pedidosMes) {
        for (const c of (p.pedido_colecciones || [])) {
          const unidades = parseInt(c.cantidad, 10) || 0;
          const factor = (colMap[c.coleccion_id] && colMap[c.coleccion_id].cantidad_stickers) || 0;
          stickersMes += unidades * factor;
        }
      }

      const nombreMes = fecha.toLocaleString('es-MX', { month: 'long', year: 'numeric' });
      porMes.push({
        mes:      nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1),
        pedidos:  pedidosMes.length,
        stickers: stickersMes
      });
    }

    // ── Respuesta ─────────────────────────────────────────────────────────────
    res.json({
      total_stickers:        totalStickers,
      pedidos_completados:   pedidosCompletados,
      pedidos_pendientes:    pedidosPendientes,
      tiempo_promedio_horas: tiempoPromedioHoras,
      por_coleccion:         porColeccionConAcumulado,
      pareto:                porColeccionConAcumulado,
      por_semana:            porSemana,
      por_mes:               porMes,
      tiempos_produccion:    tiemposProduccion
    });
  } catch (err) {
    console.error('Error al obtener estadísticas:', err);
    res.status(500).json({ error: 'Error interno al obtener estadísticas.' });
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
