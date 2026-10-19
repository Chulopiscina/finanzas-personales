# Interfaz Finanzas

Rediseño de presentación sobre el Atajo universal de `f49efb3`. Sin cambios en
API, cálculo financiero, Prisma, migraciones ni credenciales. No se ha publicado.

## Sistema visual

- Fondo grafito con matiz verde; superficies elevadas discretamente, esmeralda
  como acento, coral para gastos, azul para resultado y lavanda para gasto fijo.
- Modo claro blanco conservado, sin cambiar la persistencia de tema.
- Tipografía nativa del dispositivo, cifras tabulares, tamaños fijos y contraste
  mediante tokens de `globals.css`. Sin fuentes remotas ni nuevas dependencias.
- Bordes de 8 px, separadores, espacios de 4/8/12/16/24 px, transiciones de
  150–200 ms y respeto de `prefers-reduced-motion`.
- `PageHeader`, `PlanningNavigation`, controles UI y clases `surface`,
  `finance-select`, `action-link` y `empty-state` compartidos.

## Interacción

- Navegación lateral agrupada y contraíble con persistencia; en móvil, acceso
  inferior a inicio, movimientos, planificación y resto de secciones.
- Movimientos: tabla en espacio suficiente, tarjetas compactas en móvil,
  edición de cuenta/categoría desplegable y acciones siempre disponibles.
- Cuentas y categorías: tarjetas individuales, edición y archivo conservados.
- Presupuestos, objetivos y pagos comparten navegación; formularios existentes
  se conservan y se separan de sus resultados.
- Gráficos cargados de forma diferida. Leyenda de categorías seleccionable con
  teclado/táctil; importes y porcentajes; evolución con selector de serie y
  tabla de datos accesible. No se fabrica un histórico de saldo: el backend
  actual proporciona ingresos, gastos netos y resultado, no saldos históricos.
- Los importes negativos por reembolsos permanecen en la leyenda, sin intentar
  dibujar un sector negativo. No se convierten ni modifican las cantidades.

## Verificación reproducible

`npm run test:system` levanta PostgreSQL desechable en localhost, aplica las
migraciones solo allí y ejecuta tests y Playwright a 1600 y 390 px. El usuario
visual tiene datos sintéticos separados del usuario de pruebas de login para
no agotar su límite de acceso. Nunca se desactiva ese límite en la aplicación.

Las capturas están en `outputs/playwright`. Las pruebas cubren navegación,
temas, ausencia de desbordamiento de página, interacciones gráficas, creación y
edición de cuentas/categorías y las regresiones funcionales ya existentes.
Chromium móvil no sustituye la comprobación física de Safari/iPhone.

Para revisar sin tocar datos reales, tras el build:
`node scripts/test-local-db.mjs --web --preview`. Imprime una URL solo accesible
en localhost; usa una base nueva y Atajos desactivado. Acceso ficticio:
`design-fixture@example.test` / `VistaLocal2026!`. No es una contraseña de
producción ni modifica usuarios existentes. Detener con Ctrl+C limpia el entorno.
