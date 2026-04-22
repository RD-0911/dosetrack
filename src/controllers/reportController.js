const pool = require("../config/db");

// GET /api/reports/summary
const getSummary = async (req, res) => {
  try {
    const { id_usuario } = req.user;

    const [rows] = await pool.query(
      `SELECT
          COUNT(*)                                             AS total,
          SUM(estado_toma = 'tomado')                         AS tomadas,
          SUM(estado_toma = 'omitido')                        AS omitidas,
          SUM(estado_toma = 'pendiente')                      AS pendientes,
          ROUND(
            SUM(estado_toma = 'tomado') /
            NULLIF(SUM(estado_toma IN ('tomado','omitido')), 0) * 100
          , 1)                                                AS adherencia_pct
       FROM tomas
       WHERE id_usuario = ?`,
      [id_usuario]
    );

    const [por_med] = await pool.query(
      `SELECT
          m.nombre_medicamento,
          COUNT(*)                                             AS total,
          SUM(t.estado_toma = 'tomado')                       AS tomadas,
          SUM(t.estado_toma = 'omitido')                      AS omitidas,
          ROUND(
            SUM(t.estado_toma = 'tomado') /
            NULLIF(SUM(t.estado_toma IN ('tomado','omitido')), 0) * 100
          , 1)                                                AS adherencia_pct
       FROM tomas t
       INNER JOIN medicamentos m ON t.id_medicamento = m.id_medicamento
       WHERE t.id_usuario = ?
       GROUP BY m.id_medicamento, m.nombre_medicamento
       ORDER BY m.nombre_medicamento ASC`,
      [id_usuario]
    );

    const [por_dia] = await pool.query(
      `SELECT
          DATE_FORMAT(fecha_programada, '%Y-%m-%d') AS fecha,
          SUM(estado_toma = 'tomado')               AS tomadas,
          SUM(estado_toma = 'omitido')              AS omitidas,
          COUNT(*)                                  AS total
       FROM tomas
       WHERE id_usuario = ?
         AND fecha_programada >= CURDATE() - INTERVAL 30 DAY
       GROUP BY fecha_programada
       ORDER BY fecha_programada ASC`,
      [id_usuario]
    );

    res.json({
      ok: true,
      data: {
        resumen: rows[0],
        por_medicamento: por_med,
        por_dia,
      },
    });
  } catch (error) {
    console.error("getSummary error:", error);
    res.status(500).json({ ok: false, message: "Error al obtener reporte" });
  }
};

module.exports = { getSummary };