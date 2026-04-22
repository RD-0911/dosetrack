const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const register = async (req, res) => {
  try {
    const { nombre, correo, password, telefono } = req.body;

    if (!nombre || !correo || !password) {
      return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    const [existing] = await pool.query(
      "SELECT id_usuario FROM usuarios WHERE correo = ?",
      [correo]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: "El correo ya está registrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO usuarios (id_rol, nombre, correo, password_hash, telefono, estado)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [2, nombre, correo, hashedPassword, telefono || null, "activo"]
    );

    await pool.query(
      `INSERT INTO configuracion_usuario
      (id_usuario, notificaciones_activas, sonido_activo, modo_oscuro, tamano_fuente, respaldo_nube)
      VALUES (?, true, true, false, 'normal', true)`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Usuario registrado correctamente",
      id_usuario: result.insertId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al registrar usuario" });
  }
};

const login = async (req, res) => {
  try {
    const { correo, password } = req.body;

    const [users] = await pool.query(
      `SELECT id_usuario, id_rol, nombre, correo, password_hash, estado
       FROM usuarios
       WHERE correo = ?`,
      [correo]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    const user = users[0];

    if (user.estado !== "activo") {
      return res.status(403).json({ message: "Usuario inactivo o bloqueado" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    const token = jwt.sign(
      {
        id_usuario: user.id_usuario,
        id_rol: user.id_rol,
        correo: user.correo,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    await pool.query(
      "UPDATE usuarios SET ultimo_acceso = NOW() WHERE id_usuario = ?",
      [user.id_usuario]
    );

    res.json({
      message: "Login correcto",
      token,
      user: {
        id_usuario: user.id_usuario,
        id_rol: user.id_rol,
        nombre: user.nombre,
        correo: user.correo,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al iniciar sesión" });
  }
};

module.exports = {
  register,
  login,
};