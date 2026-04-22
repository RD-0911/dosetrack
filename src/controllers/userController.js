const pool = require("../config/db");

const getProfile = async (req, res) => {
  try {
    const { id_usuario } = req.user;

    const [rows] = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.correo, u.telefono, u.foto_perfil,
              c.notificaciones_activas, c.sonido_activo, c.modo_oscuro,
              c.tamano_fuente, c.respaldo_nube
       FROM usuarios u
       LEFT JOIN configuracion_usuario c ON u.id_usuario = c.id_usuario
       WHERE u.id_usuario = ?`,
      [id_usuario]
    );

    console.log("PROFILE ROWS:", rows);

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "Usuario no encontrado"
      });
    }

    res.json({
      ok: true,
      data: rows[0]
    });
  } catch (error) {
    console.error("getProfile error:", error);
    res.status(500).json({
      ok: false,
      message: "Error al obtener perfil"
    });
  }
};

module.exports = {
  getProfile,
};