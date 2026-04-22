const pool = require("../config/db");

const createMedication = async (req, res) => {
  try {
    const { id_usuario } = req.user;
    const {
      nombre_medicamento,
      dosis,
      frecuencia_tipo,
      fecha_inicio,
      fecha_fin,
      instrucciones,
      notificaciones_activas,
      horarios,
    } = req.body;

    const [result] = await pool.query(
      `INSERT INTO medicamentos
      (id_usuario, nombre_medicamento, dosis, frecuencia_tipo, fecha_inicio, fecha_fin, instrucciones, notificaciones_activas, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'activo')`,
      [
        id_usuario,
        nombre_medicamento,
        dosis,
        frecuencia_tipo,
        fecha_inicio,
        fecha_fin || null,
        instrucciones || null,
        notificaciones_activas ?? true,
      ]
    );

    const id_medicamento = result.insertId;

    if (Array.isArray(horarios) && horarios.length > 0) {
      for (const hora of horarios) {
        await pool.query(
          `INSERT INTO horarios_medicamento (id_medicamento, hora_programada, activo)
           VALUES (?, ?, true)`,
          [id_medicamento, hora]
        );
      }
    }

    res.status(201).json({
      ok: true,
      message: "Medicamento creado correctamente",
      id_medicamento,
    });
  } catch (error) {
    console.error("createMedication error:", error);
    res.status(500).json({
      ok: false,
      message: "Error al crear medicamento",
    });
  }
};

const getMedications = async (req, res) => {
  try {
    const { id_usuario } = req.user;

    const [rows] = await pool.query(
      `SELECT * FROM medicamentos
       WHERE id_usuario = ? AND estado = 'activo'
       ORDER BY fecha_creacion DESC`,
      [id_usuario]
    );

    console.log("MEDICATIONS ROWS:", rows);

    res.json({
      ok: true,
      data: rows,
    });
  } catch (error) {
    console.error("getMedications error:", error);
    res.status(500).json({
      ok: false,
      message: "Error al obtener medicamentos",
    });
  }
};

module.exports = {
  createMedication,
  getMedications,
};