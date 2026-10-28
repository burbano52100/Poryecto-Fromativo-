# Documentación Oficial de Frontend - GastroSENA

> **REGLA OBLIGATORIA DEL PROYECTO (POLÍTICA DE COMMIT):**  
> Todo cambio realizado en el frontend (`frontend/`), sin excepción y por pequeño que sea (corrección de bugs, nuevos módulos, ajustes de UI, hooks o refactorizaciones), **debe quedar documentado en esta carpeta (`frontend/docs/`) y registrado en `CHANGELOG.md` dentro del mismo commit**. No se admiten commits en ramas de frontend sin su respectiva actualización documental.

---

## 🗂️ Estructura de la Documentación

Esta carpeta centraliza el conocimiento arquitectónico, histórico y de integración de la aplicación web:

| Documento | Descripción |
|---|---|
| **[CHANGELOG.md](./CHANGELOG.md)** | Bitácora cronológica exhaustiva de cambios, refactorizaciones, motivos técnicos y archivos afectados. |
| **[LOGIN_Y_REDIRECCIONAMIENTO.md](./LOGIN_Y_REDIRECCIONAMIENTO.md)** | Especificación del flujo de autenticación, protecciones de ruta, seguridad en producción y activos visuales (logo y fondo). |
| **[PASO_5_BENEFICIARIOS.md](./PASO_5_BENEFICIARIOS.md)** | Documento funcional y técnico del Módulo de Beneficiarios (Paso 5) para Encargado y Aprendiz. |
| **[PENDIENTES_BACKEND.md](./PENDIENTES_BACKEND.md)** | Matriz de endpoints requeridos por el frontend que aún no existen, están a medias o presentan discrepancias de contrato con el backend. |
| **[ESTRUCTURA.md](./ESTRUCTURA.md)** | Mapa del árbol de directorios del frontend bajo la metodología *Atomic Design* y responsabilidades de cada capa. |

---

## 📌 Guía Rápida para Desarrolladores y Agentes

Antes de realizar un commit en cualquier rama de frontend (ej. `julianDEV-front`):
1. **Verificar código limpio:** Ejecutar `npm run lint` y `npm run build` en `frontend/` y validar 0 errores.
2. **Actualizar `CHANGELOG.md`:** Añadir una nueva entrada con fecha, autor/rama, resumen de cambios y lista de archivos modificados/creados.
3. **Actualizar documentos funcionales:** Si el cambio impacta rutas, beneficiarios o estado de backend, actualizar `LOGIN_Y_REDIRECCIONAMIENTO.md`, `PASO_5_BENEFICIARIOS.md` o `PENDIENTES_BACKEND.md`.
4. **Hacer commit atómico:** Incluir tanto el código fuente como los archivos de `frontend/docs/` en la misma confirmación de Git.
