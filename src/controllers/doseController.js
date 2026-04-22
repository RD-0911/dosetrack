const pool = require("../config/db");

const generateTodayDoses = async (req, res) => {
  try {
    const { id_usuario } = req.user;

    const [horarios] = await pool.query(
      `SELECT 
          m.id_medicamento,
          h.id_horario,
          h.hora_programada
       FROM medicamentos m
       INNER JOIN horarios_medicamento h 
         ON m.id_medicamento = h.id_medicamento
       WHERE m.id_usuario = ?
         AND m.estado = 'activo'
         AND h.activo = true
         AND (m.fecha_inicio IS NULL OR m.fecha_inicio <= CURDATE())
         AND (m.fecha_fin IS NULL OR m.fecha_fin >= CURDATE())`,
      [id_usuario]
    );

    let creadas = 0;

    for (const item of horarios) {
      const [exists] = await pool.query(
        `SELECT id_toma
         FROM tomas
         WHERE id_usuario = ?
           AND id_medicamento = ?
           AND id_horario = ?
           AND fecha_programada = CURDATE()`,
        [id_usuario, item.id_medicamento, item.id_horario]
      );

      if (exists.length === 0) {
        await pool.query(
          `INSERT INTO tomas
          (id_usuario, id_medicamento, id_horario, fecha_programada, hora_programada, estado_toma, registrado_desde)
          VALUES (?, ?, ?, CURDATE(), ?, 'pendiente', 'sistema')`,
          [id_usuario, item.id_medicamento, item.id_horario, item.hora_programada]
        );
        creadas++;
      }
    }

    res.json({
      ok: true,
      message: "Tomas del día generadas",
      creadas,
    });
  } catch (error) {
    console.error("generateTodayDoses error:", error);
    res.status(500).json({
      ok: false,
      message: "Error al generar tomas del día",
    });
  }
};

const getTodayDoses = async (req, res) => {
  try {
    const { id_usuario } = req.user;

    const [rows] = await pool.query(
      `SELECT
          t.id_toma,
          t.id_medicamento,
          t.id_horario,
          t.fecha_programada,
          t.hora_programada,
          t.fecha_hora_registro,
          t.estado_toma,
          t.observaciones,
          m.nombre_medicamento,
          m.dosis
       FROM tomas t
       INNER JOIN medicamentos m
         ON t.id_medicamento = m.id_medicamento
       WHERE t.id_usuario = ?
         AND t.fecha_programada = CURDATE()
       ORDER BY t.hora_programada ASC`,
      [id_usuario]
    );

    console.log("TODAY DOSES:", rows);

    res.json({
      ok: true,
      data: rows,
    });
  } catch (error) {
    console.error("getTodayDoses error:", error);
    res.status(500).json({
      ok: false,
      message: "Error al obtener tomas del día",
    });
  }
};

const updateDoseStatus = async (req, res) => {
  try {
    const { id_usuario } = req.user;
    const { id } = req.params;
    const { estado_toma, observaciones } = req.body;

    if (!["tomado", "omitido", "pendiente"].includes(estado_toma)) {
      return res.status(400).json({
        ok: false,
        message: "Estado no válido",
      });
    }

    let fechaHoraRegistro = null;
    let retrasoMinutos = null;

    if (estado_toma === "tomado" || estado_toma === "omitido") {
      const [doseRows] = await pool.query(
        `SELECT fecha_programada, hora_programada
         FROM tomas
         WHERE id_toma = ? AND id_usuario = ?`,
        [id, id_usuario]
      );

      if (doseRows.length === 0) {
        return res.status(404).json({
          ok: false,
          message: "Toma no encontrada",
        });
      }

      const dose = doseRows[0];
      fechaHoraRegistro = new Date();

      const programada = new Date(
        `${dose.fecha_programada.toISOString().split("T")[0]}T${dose.hora_programada}`
      );

      retrasoMinutos = Math.max(
        0,
        Math.floor((fechaHoraRegistro.getTime() - programada.getTime()) / 60000)
      );
    }

    await pool.query(
      `UPDATE tomas
       SET estado_toma = ?,
           observaciones = ?,
           fecha_hora_registro = ?,
           retraso_minutos = ?
       WHERE id_toma = ? AND id_usuario = ?`,
      [
        estado_toma,
        observaciones || null,
        fechaHoraRegistro,
        retrasoMinutos,
        id,
        id_usuario,
      ]
    );

    res.json({
      ok: true,
      message: "Estado de toma actualizado",
    });
  } catch (error) {
    console.error("updateDoseStatus error:", error);
    res.status(500).json({
      ok: false,
      message: "Error al actualizar estado de toma",
    });
  }
};
const getDoseHistory = async (req, res) => {
  try {
    const { id_usuario } = req.user;

    const [rows] = await pool.query(
      `SELECT
          t.id_toma,
          t.fecha_programada,
          t.hora_programada,
          t.estado_toma,
          t.fecha_hora_registro,
          t.observaciones,
          m.nombre_medicamento,
          m.dosis
       FROM tomas t
       INNER JOIN medicamentos m
         ON t.id_medicamento = m.id_medicamento
       WHERE t.id_usuario = ?
       ORDER BY t.fecha_programada DESC, t.hora_programada ASC`,
      [id_usuario]
    );

    console.log("DOSE HISTORY:", rows);

    res.json({
      ok: true,
      data: rows,
    });
  } catch (error) {
    console.error("getDoseHistory error:", error);
    res.status(500).json({
      ok: false,
      message: "Error al obtener historial",
    });
  }
};

module.exports = {
  generateTodayDoses,
  getTodayDoses,
  updateDoseStatus,
  getDoseHistory,

};