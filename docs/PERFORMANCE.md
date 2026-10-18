# Rendimiento: medición local y cambios

## Antes / después

18/10/2026, Windows, Node 24, PostgreSQL 18 efímero en loopback. Fixture aislada: un usuario, una cuenta, 2.000 movimientos (500 caracteres de datos originales por fila), 12 objetivos visibles sobre la misma categoría. Mismo proceso de medición; cuatro lecturas, primera descartada, mediana de las tres restantes.

| Dashboard + planificación visible | Antes (`327c7d3`) | Después |
| --- | ---: | ---: |
| Tiempo instrumentado | 798,95 ms | 535,88 ms |
| Operaciones Prisma de alto nivel | 12 | 9 |
| Bytes JSON de resultados DB hacia servidor | 4.582.352 | 1.309.199 |

Reducción aproximada: 33 % de tiempo, 25 % de operaciones y 71 % de datos recuperados. Los bytes no son tráfico HTTP ni paquetes PostgreSQL; las operaciones no son número de sentencias SQL internas. La instrumentación JSON añade coste en ambos casos. No es una medición de Vercel/Supabase ni de un iPhone físico.

Planificación: con la misma fixture, la lista serializada pasaba de **7.517.211** a **50.283 bytes** al enviar las doce filas realmente mostradas por objetivo, manteniendo los 2.000 movimientos en el cálculo, sus contadores y el mismo resultado financiero. No se han limitado los totales a esas doce filas.

Comprobación de navegador posterior, con 61 movimientos ficticios: 912 ms entre pulsar Entrar y ver la cabecera del dashboard en escritorio y 896 ms en viewport móvil 390x844. Incluye bcrypt/login y servidor local; no hay comparación anterior equivalente de navegador. Chromium móvil emula dimensiones/táctil, no hardware iPhone ni Safari.

## Qué era lento y qué se cambió

- Dashboard consultaba dos veces objetivos y movimientos para planificación, de forma encadenada. Ahora reutiliza filas compactas del periodo y objetivos de la primera tanda de consultas.
- Se eliminó una consulta de cuenta predeterminada en cada visita cuando ya existen cuentas; se mantiene su creación inicial.
- Relaciones de reembolsos/cuentas recuperaban objetos completos, incluido JSON bancario. Se seleccionan solo columnas necesarias; el detalle financiero sigue cargándose al abrirlo.
- Planificación cargaba los objetivos dos veces y enviaba todos los movimientos aun mostrando doce. Ahora comparte la consulta de objetivos y limita solo la lista enviada. Se mantiene la recarga verificada tras guardar: una variante con navegación parcial mostró estados visuales obsoletos intermitentes y no se conserva.
- Movimientos conserva paginación real 25/50, búsqueda con debounce y filtros en PostgreSQL. Sus filas/reembolsos ahora usan `select` y no recuperan originales privados innecesarios.
- El menú lateral dejaba que Next precargase simultáneamente todas las pantallas financieras. Ahora solo precarga el enlace con intención de ratón/foco.
- Los gráficos no se montan hasta acercarse al viewport; se mantiene un espacio de carga estable y fallback si falta IntersectionObserver.
- Antiduplicados usa conjuntos/índices en memoria por identidad y referencia; evita copiar listas repetidamente. No fusiona dos cargos iguales sin evidencia suficiente.
- No se añadió caché financiera compartida ni detección de transferencias al navegar. Se conserva el cálculo exacto común de céntimos/reembolsos/objetivos; no se sustituyó por agregaciones SQL que pudieran divergir.
- No se duplicaron índices financieros ya existentes y comprobados. La migración nueva solo añade índices de la bandeja/credenciales de Atajos.

## Reproducir y próximos límites

```bash
npm run test:local-db
npm run test:system
```

Solo usan `finanzas_test` desechable en localhost; no usan producción. Resultados en `outputs/dashboard-before.json`, `dashboard-after.json`, `planning-lists.json` y capturas Playwright. La primera referencia histórica se conservó antes de modificar las consultas; en una instalación nueva el fichero `before` ya no representa automáticamente el código antiguo. Comparar con la tabla anterior, no presentar el primer run actual como baseline histórico.

Pendiente: medir con la cuenta real después de autorización de despliegue, red móvil y Safari/iPhone físico. Comprobar región efectiva de funciones Vercel frente a Supabase y latencia de consultas; no se cambiaron región, conexiones ni secretos. Con historiales mucho mayores, perfilar SQL con datos anonimizados antes de introducir agregados/materialización. El modo Todo aún necesita las filas compactas del historial para las reglas compartidas de reembolsos y objetivos.
