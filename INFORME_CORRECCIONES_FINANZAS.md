# Informe de estabilización de Finanzas Personales

Fecha: 18 de octubre de 2026. Base revisada: `14f0279` (`Fix Prisma Supabase pooler runtime`). Referencia principal: auditoría del 18/10/2026 guardada fuera del repositorio. Esta intervención autoriza correcciones; no es una segunda auditoría de solo lectura.

## Conclusión y publicación

Se han corregido problemas de aislamiento, sesiones, clasificación contable, importaciones y rendimiento, con pruebas locales de base de datos y navegador. **No equivale a una certificación de seguridad ni a una reconciliación bancaria de producción.**

El despliegue queda condicionado a verificar/aplicar la migración aditiva `20261018130000_login_rate_limit` en Supabase. No hay acceso autenticado a Vercel ni conexión segura verificada a producción en esta sesión. No se publicará automáticamente a `main` sin esa comprobación, para no dejar inutilizado el login. El commit local conserva el trabajo; no se han ejecutado migraciones ni cambiado datos financieros reales.

## 1. Seguridad y privacidad

### Corregido

- `/api/transactions` ya no lista categorías privadas de otros usuarios. Solo categorías propias y plantillas comunes.
- Contadores de categorías filtrados por el propietario de los movimientos, incluidas las categorías compartidas.
- Revisión de guards de cuentas, movimientos, categorías, extractos, objetivos, presupuestos, pagos y administración. API comprueba sesión y propiedad/rol, no confía en esconder enlaces.
- Middleware movido a `src/middleware.ts`, donde corresponde a la estructura `src/app`. Añadidos caminos privados que faltaban.
- Comprobación de origen en mutaciones y rechazo de peticiones cross-site. Cabeceras básicas de seguridad y `private, no-store` en API.
- Cambio de contraseña y cambios administrativos de contraseña/rol revocan sesiones. El cambio personal exige contraseña actual y vuelve al login.
- Protección de último administrador con transacción serializable; confirmación de eliminación en administración.
- Seed sin contraseña/correo de administrador predeterminados y sin elevar/resetear usuarios existentes. Contraseñas nuevas: 12 caracteres mínimo, mayúscula/minúscula/número, máximo 72 bytes de bcrypt.
- Limitador de login persistente en PostgreSQL: 10 intentos por correo y 40 por IP en ventana fija de 15 minutos, claves HMAC y limpieza de contadores caducados. Funciona entre instancias serverless; no depende de memoria local. IP bloqueada no crea nuevas claves de correo.
- Respuestas de errores no devuelven excepciones Prisma, rutas internas ni cadenas de conexión. Se devuelve una referencia; conflictos/indisponibilidad tienen estados específicos.
- Next.js actualizado a 15.5.28, PostCSS a 8.5.30 y dependencia transitiva de imagen corregida mediante override compatible. Node acotado a 24.x.

### No modificado en producción

No se han rotado contraseñas existentes ni secretos. Si sobreviven credenciales iniciales conocidas, cambiarlas antes de incorporar usuarios. No se ha comprobado RLS/permisos del esquema Supabase desde el proveedor. La autorización de aplicación no sustituye esos controles si se habilita acceso directo desde clientes en el futuro.

## 2. Reglas financieras

El criterio completo está en [FINANCIAL_RULES.md](docs/FINANCIAL_RULES.md).

- Nuevo núcleo `money.ts`/`ledger.ts`: céntimos exactos, reparto proporcional que conserva los céntimos y clasificación común.
- Transferencias a terceros se consideran ingreso/gasto por signo. Solo una transferencia interna confirmada se excluye de ingresos/gastos.
- Retirada la detección que vinculaba automáticamente importes altos parecidos. El modal busca candidatos bajo demanda, pero el usuario confirma. Vincular/desvincular ambas patas es atómico; quitar interna restaura el tipo por signo.
- Saldo de cuenta: último saldo bancario + operaciones posteriores; sin ancla, saldo inicial + movimientos. Saldo global suma cuentas activas, no saldos mensuales históricos. Cuentas distingue confirmado y calculado.
- Las nuevas importaciones conservan secuencia de filas para desempatar operaciones del mismo día.
- Reembolsos con criterio de caja: reducen gasto en su fecha de recepción y categorías de los gastos originales. No se descuenta entero el mismo reembolso de varias compras. Se rechazan nuevas asociaciones que excedan el gasto reembolsable.
- Dashboard, categorías/gráficos, presupuestos y planificación usan el reparto común. Un periodo con solo devoluciones puede mostrar gasto neto negativo, de forma deliberada.
- Ahorro asociado a salidas se muestra positivo; un grupo de transferencia explícitamente incluido cuenta una sola vez. Asociaciones automáticas y manuales se unen por id. Se descuentan también devoluciones de aportaciones manuales de meses anteriores.
- Objetivos del dashboard respetan cuenta/rango, fechas personalizadas y estado activo. La tarjeta agregada incluye solo objetivos de ahorro activos.
- Corregida la inclusión del presupuesto del mes de inicio de un ciclo cerrado. Las categorías de distintos presupuestos no se mezclan indiscriminadamente.
- Próximos pagos conserva el día original al avanzar meses; no genera gastos reales.

No se ha reclasificado masivamente ningún movimiento real. Revisar internamente los grupos de transferencias ya marcados por la lógica antigua. El saldo sigue siendo actual aunque se seleccione un periodo histórico: no se promete un balance histórico a cierre.

## 3. Importación segura

- Conservada la vista previa y la confirmación explícita; subir un archivo no crea movimientos.
- Fechas imposibles rechazadas, incluidos ISO con días que JavaScript convertiría al mes siguiente. Se conserva el día contable sin desplazarlo por zona horaria.
- Identidad multiformato normalizada por día, céntimos, descripción, referencia/saldo cuando existen. Detección por multiplicidad para preservar dos operaciones legítimas idénticas.
- Confirmación atómica e idempotente, con bloqueo por usuario/cuenta para confirmaciones simultáneas. Error de inserción revierte también cambios parciales.
- Cancelación/eliminación serializadas con confirmación. Se mantiene la elección explícita entre eliminar registro o también movimientos.
- Validación de continuidad de saldos por fila y de saldos declarados inicial/final. Inferir un saldo no otorga confianza alta.
- BBVA ignora resúmenes/pies y exige importe de su fila. ING/Caixa rechazan filas candidatas incompletas en vez de importar parcialmente sin aviso. Trade Republic prioriza fecha contable frente a hora.
- CSV compatible no identificado con certeza se presenta con confianza baja y exige confirmación adicional.
- Vistas previas paginadas (100 filas), originales no incluidos en listas y descarga autorizada en servidor. Máximo 4 MB y 5.000 filas por archivo.
- Excepciones inesperadas de infraestructura no se muestran como mensajes del parser.

Límites: sin OCR; formatos nuevos requieren ejemplos. Sin referencia/saldo, dos operaciones idénticas y documentos solapados tienen ambigüedad inevitable. Descripciones muy distintas entre PDF y CSV aún pueden requerir revisión manual. Los antiguos archivos adjuntos de Downloads no están disponibles en esta sesión; las regresiones de parser usan texto y CSV ficticios, no esos originales bancarios.

## 4. Rendimiento

- Saldo calculado con una consulta SQL agregada por cuenta, sin descargar el histórico entero solo para sumar.
- Dashboard filtra por periodo y evita copiar todos los detalles a varias tarjetas. Detalles paginados cargados al abrirlos.
- Movimientos: páginas 25/50, filtros/búsqueda en base de datos, debounce, orden estable por fecha/creación/id. Corregido el efecto que devolvía la página 2 a la primera. API antigua también paginada.
- Candidatos de transferencia/reembolso se consultan al abrir el modal, no se limitan a la página visible.
- Objetivos: una consulta de objetivos y otra de sus movimientos, no una por objetivo. Presupuestos comparten una consulta de movimientos.
- No se reconstruyen todos los resúmenes mensuales tras cada edición ni se ejecuta detección automática al visitar el dashboard.
- Listas de extractos paginadas y DTO sin originales/base64/preview completo. Perfil carga solo los últimos registros.
- Estadísticas usa carga diferida de Recharts. Primera carga indicada por Next: unos 104 kB (antes, aproximadamente 210 kB).
- Sin caché financiera compartida entre usuarios. Sesión memoizada solo dentro de la petición. Se mantiene Prisma singleton y conexión limitada con pooler.
- Revisados los índices existentes de usuario/cuenta/fecha/categoría/extracto/tipo/transferencia/objetivos/reembolsos. No se han añadido índices financieros redundantes. El único índice nuevo es la caducidad del limitador de login.

### Medición reproducible

`tests/database/benchmark.test.ts`, PostgreSQL local efímero, datos ficticios, mediana de tres iteraciones calientes. Se compara descargar filas para el saldo frente a la consulta agregada; **no** mide el dashboard completo ni la latencia Supabase/Vercel.

| Movimientos | Filas antes/después | Payload JSON antes/después | Mediana antes/después |
| --- | --- | --- | --- |
| 1.000 | 1.000 / 1 | 73.001 / 101 bytes | 14,83 / 2,50 ms |
| 10.000 | 10.000 / 1 | 730.001 / 102 bytes | 83,79 / 4,93 ms |

Las medidas pueden variar en cada ejecución; la salida actual se escribe en `outputs/benchmark.json` y no se versiona.

Pendiente: en vista Todo, cálculos complejos todavía cargan las filas financieras del periodo; no se ha convertido todo a SQL ni impuesto límites que oculten datos. Para historiales grandes habrá que medir con staging y optimizar según planes reales.

## 5. Móvil y PWA

- Tabla compacta y acciones accesibles; tarjetas en móvil/tablet según ancho real del contenido. Paginación usable sin bajar a una barra horizontal.
- Tarjetas móviles para extractos, cuentas, vista previa y detalles de métricas. Edición de cuenta disponible también en móvil.
- Formularios/modales limitados al viewport, foco atrapado y restaurado, cierre Escape, estados de error de red y timeout de 60 segundos sin reintentos automáticos de escrituras.
- Mejoras de foco, navegación móvil y respeto a reducción de movimiento. Tema oscuro conservado.
- Manifest, iconos PNG 192/512 y Apple 180, metadatos standalone. No service worker ni caché offline de finanzas. No hay notificaciones bancarias ni sincronización en segundo plano.

Se ha comprobado Chromium a 1600x1000 y 390x844, capturas y ausencia de desbordamiento horizontal en dashboard/movimientos. No se ha probado instalación real en Safari/iPhone o Android físico, ni todos los formularios con lector de pantalla.

## 6. Pruebas y calidad

Suite nueva en `tests/`, Vitest, PostgreSQL real desechable y Playwright. `test:system` no utiliza las URLs de `.env`; arranca su propia base `finanzas_test` en loopback con contraseña aleatoria y la cierra al terminar. Las 14 migraciones se aplicaron allí, no en Supabase.

Cobertura: céntimos/repartos, saldos ancla, transferencias propias/terceros, reembolsos entre meses, objetivos/presupuesto, fechas, parsers, duplicados, rollback y confirmación concurrente; handlers multiusuario y HTTP real de login, CSRF, denegación de recursos ajenos, reembolsos, vinculación/desvinculación, cambio de contraseña y revocación. Navegador comprueba login, dashboard real, paginación persistente, acciones visibles, gráficos, manifest/iconos y ausencia de service worker.

Comandos previstos para cierre: `prisma validate`, `prisma generate`, `lint`, `typecheck`, `test:system`, `build`, `vercel-build` y auditoría de dependencias runtime. Los resultados finales se registran en el apartado de cierre tras la ejecución; no se considera suficiente que compile.

GitHub Actions configura los mismos controles sin secretos de producción. Hay que activar protección de rama y condición de despliegue en GitHub/Vercel; no se han cambiado esos ajustes externos.

## 7. Archivos principales

- Seguridad: `src/middleware.ts`, `src/lib/auth.ts`, `login-rate-limit.ts`, `api.ts`, rutas auth/profile/admin/categories/transactions.
- Dominio: `src/lib/money.ts`, `ledger.ts`, `finance.ts`, `planning.ts`, `budgets.ts`, `recurring-payments.ts`.
- Importación: `csv.ts`, `pdf.ts`, `import-preview.ts`, `import-identity.ts`, `import-service.ts`, `statement-dto.ts` y rutas imports.
- UI: transactions-table, dashboard-metrics/charts, accounts-manager, import-history-list, upload-dropzone, use-dialog-focus y client-request.
- PWA: `src/app/manifest.ts`, metadata en layout, `public/icon-*.png`, `scripts/generate-icons.mjs`.
- Calidad: `tests/`, `scripts/test-local-db.mjs`, configuraciones ESLint/Vitest/Playwright, `.github/workflows/ci.yml`.
- Datos: solo nuevo modelo/migración `LoginRateLimit`.

## 8. Riesgos y plan antes de invitar a la familia

1. Verificar estado de Supabase y aplicar la migración aditiva antes de publicar. Procedimiento y SQL en [DEPLOYMENT.md](docs/DEPLOYMENT.md). No usar resets ni marcar migraciones antiguas como aplicadas sin verificar.
2. Rotar contraseña inicial y secretos que se hayan compartido históricamente; comprobar permisos del esquema y backups/restauración.
3. Ejecutar smoke tests en staging con dos usuarios y extractos anonimizados reales de cada banco. Comprobar Runtime Logs del deployment publicado.
4. Revisar transferencias/grupos antiguos y saldos con varias filas antiguas del mismo día sin secuencia. No hay reconciliación automática ni cambios retroactivos de datos reales.
5. No mezclar divisas: no hay conversión FX y se mantiene presentación EUR. Revisar cualquier cuenta heredada en otra moneda antes de interpretar totales globales.
6. Quedan 9 paquetes con avisos en dependencias de desarrollo (7 altos y 2 moderados; Tailwind/ESLint y transitivas). No afectan al árbol runtime auditado, pero requieren aislamiento de builds y actualización de toolchain aparte; no se ha forzado Tailwind 4 ni una bajada de Next incompatible para silenciar el informe. Los secretos compartidos históricamente pueden seguir en conversaciones/historial Git: retirarlos del seed no sustituye rotarlos.
7. Faltan prueba de carga concurrente contra pooler, cobertura exhaustiva de cada formulario, Safari real y auditoría externa de seguridad. El CSP añadido es básico, no una política completa con nonces.
8. Añadir una política de retención/borrado de originales y registros personales conforme al uso familiar; esta intervención no elimina documentos reales.

## Cierre de verificación

- `npx prisma validate`: correcto.
- `npx prisma generate`: correcto, Prisma Client 5.22.0.
- `npm run lint`: correcto, sin avisos.
- `npm run typecheck`: correcto.
- `npm run build`: correcto.
- `npm run vercel-build`: correcto; no ejecutó migraciones.
- `npm run test:system`: 51 pruebas Vitest aprobadas (7 archivos) y 4 Playwright aprobadas (escritorio/móvil), PostgreSQL real desechable y servidor Next de producción.
- `npm audit --omit=dev`: 0 vulnerabilidades notificadas en dependencias runtime. Esto no prueba ausencia de vulnerabilidades desconocidas.
- `git diff --check`: correcto tras normalizar finales de línea de archivos modificados.
- Revisión estática de secretos de los archivos preparados: sin claves privadas/tokens/cadenas reales detectadas. `.env`, `.env.local`, outputs y archivos bancarios no se incluyen en el commit.

Se conserva el commit local verificado. No se hace push ni se cambia producción hasta verificar la migración auxiliar y realizar las comprobaciones de staging descritas. No se ha ejecutado GitHub Actions en remoto en esta sesión.
