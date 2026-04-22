const pool = require("../config/db");

// Middleware helper: solo admin (id_rol = 1)
const soloAdmin = (req, res, next) => {
  if (parseInt(req.user?.id_rol) !== 1) {
    return res.status(403).json({ ok: false, message: "Acceso denegado" });
  }
  next();
};

// GET /api/admin/users — lista todos los usuarios
const getUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
          u.id_usuario, u.nombre, u.correo, u.telefono,
          u.estado, u.ultimo_acceso, u.fecha_registro,
          r.nombre AS nombre_rol,
          (SELECT COUNT(*) FROM medicamentos m WHERE m.id_usuario = u.id_usuario AND m.estado = 'activo') AS medicamentos_activos,
          (SELECT COUNT(*) FROM tomas t WHERE t.id_usuario = u.id_usuario) AS total_tomas,
          (SELECT ROUND(SUM(t.estado_toma='tomado') / NULLIF(SUM(t.estado_toma IN ('tomado','omitido')),0)*100, 1)
             FROM tomas t WHERE t.id_usuario = u.id_usuario) AS adherencia_pct
       FROM usuarios u
       INNER JOIN roles r ON u.id_rol = r.id_rol
       ORDER BY u.fecha_registro DESC`
    );
    res.json({ ok: true, data: rows });
  } catch (error) {
    console.error("getUsers error:", error);
    res.status(500).json({ ok: false, message: "Error al obtener usuarios" });
  }
};

// PUT /api/admin/users/:id/estado
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    if (!["activo", "inactivo", "bloqueado"].includes(estado)) {
      return res.status(400).json({ ok: false, message: "Estado no válido" });
    }
    if (parseInt(id) === req.user.id_usuario) {
      return res.status(400).json({ ok: false, message: "No puedes modificar tu propio estado" });
    }
    const [result] = await pool.query(
      "UPDATE usuarios SET estado = ? WHERE id_usuario = ?",
      [estado, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
    }
    res.json({ ok: true, message: `Usuario actualizado a '${estado}'` });
  } catch (error) {
    console.error("updateUserStatus error:", error);
    res.status(500).json({ ok: false, message: "Error al actualizar usuario" });
  }
};

// GET /api/admin/users/:id/doses — historial de tomas de un usuario
const getUserDoses = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT
          t.id_toma, t.fecha_programada, t.hora_programada,
          t.estado_toma, t.fecha_hora_registro, t.observaciones,
          m.nombre_medicamento, m.dosis
       FROM tomas t
       INNER JOIN medicamentos m ON t.id_medicamento = m.id_medicamento
       WHERE t.id_usuario = ?
       ORDER BY t.fecha_programada DESC, t.hora_programada ASC`,
      [id]
    );
    res.json({ ok: true, data: rows });
  } catch (error) {
    console.error("getUserDoses error:", error);
    res.status(500).json({ ok: false, message: "Error al obtener tomas del usuario" });
  }
};

// GET /api/admin/stats — estadísticas globales
const getGlobalStats = async (req, res) => {
  try {
    const [[usuarios]] = await pool.query(
      "SELECT COUNT(*) AS total, SUM(estado='activo') AS activos, SUM(estado='bloqueado') AS bloqueados FROM usuarios"
    );
    const [[tomas]] = await pool.query(
      `SELECT
          COUNT(*) AS total,
          SUM(estado_toma='tomado') AS tomadas,
          SUM(estado_toma='omitido') AS omitidas,
          SUM(estado_toma='pendiente') AS pendientes,
          ROUND(SUM(estado_toma='tomado') / NULLIF(SUM(estado_toma IN ('tomado','omitido')),0)*100, 1) AS adherencia_pct
       FROM tomas`
    );
    const [[meds]] = await pool.query(
      "SELECT COUNT(*) AS total FROM medicamentos WHERE estado='activo'"
    );
    res.json({
      ok: true,
      data: { usuarios, tomas, medicamentos_activos: meds.total },
    });
  } catch (error) {
    console.error("getGlobalStats error:", error);
    res.status(500).json({ ok: false, message: "Error al obtener estadísticas" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// 📊 ANALYTICS — nuevos endpoints
// ════════════════════════════════════════════════════════════════════════════

// GET /api/admin/analytics/adherence-daily
// Adherencia por día (últimos 30 días) — para gráfica de línea
const getAdherenceDaily = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
          DATE_FORMAT(fecha_programada, '%Y-%m-%d') AS fecha,
          COUNT(*) AS total,
          SUM(estado_toma='tomado') AS tomadas,
          SUM(estado_toma='omitido') AS omitidas,
          ROUND(SUM(estado_toma='tomado') / NULLIF(SUM(estado_toma IN ('tomado','omitido')),0)*100, 1) AS adherencia_pct
       FROM tomas
       WHERE fecha_programada >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY fecha_programada
       ORDER BY fecha_programada ASC`
    );
    res.json({ ok: true, data: rows });
  } catch (error) {
    console.error("getAdherenceDaily error:", error);
    res.status(500).json({ ok: false, message: "Error al obtener adherencia diaria" });
  }
};

// GET /api/admin/analytics/adherence-by-medication
// Adherencia por medicamento (top 10) — gráfica de barras horizontales
const getAdherenceByMedication = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
          m.nombre_medicamento,
          COUNT(t.id_toma) AS total_tomas,
          SUM(t.estado_toma='tomado') AS tomadas,
          SUM(t.estado_toma='omitido') AS omitidas,
          ROUND(SUM(t.estado_toma='tomado') / NULLIF(SUM(t.estado_toma IN ('tomado','omitido')),0)*100, 1) AS adherencia_pct
       FROM tomas t
       INNER JOIN medicamentos m ON t.id_medicamento = m.id_medicamento
       WHERE t.estado_toma IN ('tomado','omitido')
       GROUP BY m.id_medicamento, m.nombre_medicamento
       HAVING total_tomas > 0
       ORDER BY adherencia_pct DESC
       LIMIT 10`
    );
    res.json({ ok: true, data: rows });
  } catch (error) {
    console.error("getAdherenceByMedication error:", error);
    res.status(500).json({ ok: false, message: "Error al obtener adherencia por medicamento" });
  }
};

// GET /api/admin/analytics/omissions-by-hour
// Omisiones por hora del día (0-23) — gráfica de barras
const getOmissionsByHour = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
          HOUR(hora_programada) AS hora,
          COUNT(*) AS total,
          SUM(estado_toma='tomado') AS tomadas,
          SUM(estado_toma='omitido') AS omitidas
       FROM tomas
       WHERE estado_toma IN ('tomado','omitido')
       GROUP BY HOUR(hora_programada)
       ORDER BY hora ASC`
    );
    // Llenar huecos con 0
    const map = new Map(rows.map((r) => [r.hora, r]));
    const full = [];
    for (let h = 0; h < 24; h++) {
      full.push(
        map.get(h) || { hora: h, total: 0, tomadas: 0, omitidas: 0 }
      );
    }
    res.json({ ok: true, data: full });
  } catch (error) {
    console.error("getOmissionsByHour error:", error);
    res.status(500).json({ ok: false, message: "Error al obtener omisiones por hora" });
  }
};

// GET /api/admin/analytics/top-users
// Ranking de usuarios por adherencia (mejores y peores)
const getTopUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
          u.id_usuario, u.nombre, u.correo,
          COUNT(t.id_toma) AS total_tomas,
          SUM(t.estado_toma='tomado') AS tomadas,
          SUM(t.estado_toma='omitido') AS omitidas,
          ROUND(SUM(t.estado_toma='tomado') / NULLIF(SUM(t.estado_toma IN ('tomado','omitido')),0)*100, 1) AS adherencia_pct
       FROM usuarios u
       LEFT JOIN tomas t ON t.id_usuario = u.id_usuario AND t.estado_toma IN ('tomado','omitido')
       WHERE u.id_rol = 2
       GROUP BY u.id_usuario
       HAVING total_tomas > 0
       ORDER BY adherencia_pct DESC`
    );
    res.json({ ok: true, data: rows });
  } catch (error) {
    console.error("getTopUsers error:", error);
    res.status(500).json({ ok: false, message: "Error al obtener ranking" });
  }
};

module.exports = {
  soloAdmin,
  getUsers,
  updateUserStatus,
  getUserDoses,
  getGlobalStats,
  getAdherenceDaily,
  getAdherenceByMedication,
  getOmissionsByHour,
  getTopUsers,
};