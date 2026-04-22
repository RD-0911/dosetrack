const pool = require("../config/db");

// Middleware helper: solo admin (id_rol = 1)
const soloAdmin = (req, res, next) => {
  // El JWT puede traer id_rol como número o string, normalizar
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
          (SELECT COUNT(*) FROM tomas t WHERE t.id_usuario = u.id_usuario) AS total_tomas
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

// PUT /api/admin/users/:id/estado — activo | inactivo | bloqueado
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!["activo", "inactivo", "bloqueado"].includes(estado)) {
      return res.status(400).json({ ok: false, message: "Estado no válido" });
    }

    // No puede bloquearse a sí mismo
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

// GET /api/admin/users/:id/doses — historial de tomas de un usuario específico
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

module.exports = { soloAdmin, getUsers, updateUserStatus, getUserDoses, getGlobalStats };