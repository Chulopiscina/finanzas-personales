# Reglas financieras y límites

## Dinero y clasificación

- PostgreSQL conserva `Decimal(12,2)`. Los cálculos nuevos pasan por `money.ts`: céntimos enteros y reparto proporcional con `bigint` para conservar cada céntimo.
- El signo determina la clasificación contable: negativo = gasto, positivo = ingreso. La categoría no invierte el signo.
- Solo `isInternalTransfer` confirmado excluye una operación de ingresos/gastos. La palabra transferencia en el concepto no basta: un alquiler a un tercero sigue siendo gasto.
- Las etiquetas persistidas antiguas no se reescriben masivamente. Las lecturas y ediciones aplican la clasificación contable común.
- No hay conversión de divisas. Los totales globales y la presentación están preparados para EUR; no mezclar monedas distintas ni interpretar su suma como euros.

## Saldos

El saldo actual de cada cuenta es el último saldo bancario conocido más las operaciones posteriores sin ese ancla. Sin saldo bancario, es saldo inicial + movimientos. Nunca se suman saldos finales de meses distintos. El saldo total suma cuentas activas, no resultados del periodo. Por eso no cambia al filtrar un periodo histórico: es saldo actual, no saldo a cierre de ese periodo.

La pantalla Cuentas distingue saldo confirmado por extracto y calculado. Se ordena por fecha, momento de importación y secuencia dentro del extracto; los nuevos documentos guardan esa secuencia. Los registros antiguos sin secuencia conservan el desempate por creación/id. Si varias filas antiguas comparten todas esas fechas, revisar su saldo final antes de darlo por reconciliado. No se ha reimportado ni modificado documentación bancaria real.

## Transferencias propias

Vincular dos patas exige mismo usuario, cuentas distintas y cantidad exactamente opuesta. Los candidatos se consultan solo al abrir el modal; la cercanía temporal ayuda a buscarlos, no confirma automáticamente. También puede marcarse una sola pata indicando otra cuenta propia; no se crea dinero ni una contrapartida ficticia.

Ambas patas modifican los saldos de sus cuentas. Se excluyen de ingresos, gastos, categorías y resultado tanto global como por cuenta. El total informativo de transferencias cuenta un grupo una vez. Al quitar la marca o eliminar una pata se restaura la clasificación por signo de la contrapartida que permanezca. Los grupos antiguos erróneos no se deshacen silenciosamente: deben revisarse manualmente.

## Reembolsos: criterio de caja

Un ingreso vinculado a gastos es reembolso, no ingreso real. Reduce el gasto **en la fecha en que se recibe**, aunque la compra sea de otro mes. Un mes solo con devoluciones puede tener gasto neto negativo; se muestra sin ocultarlo ni mover el ingreso artificialmente al mes de la compra.

Un reembolso vinculado a varias compras se reparte según el importe bruto de cada compra, con restos por céntimos y desempate estable por id. No se resta entero a cada compra. Las nuevas asociaciones rechazan sobrepasar el importe reembolsable. No hay reparto manual de cantidades por compra en el modelo actual.

Gasto neto = bruto - reembolsos recibidos. Resultado = ingresos sin reembolsos - gasto neto. Los gráficos usan las categorías originales de las compras; pueden mostrar categorías negativas por devolución. Presupuestos y planificación usan el mismo reparto. Al filtrar cuenta, prima la cuenta donde ocurrió el movimiento/reembolso, sin trasladar dinero entre cuentas por el filtro.

## Presupuestos y ciclos

El presupuesto es mensual y opcional por cuenta. Se prioriza el específico de cuenta frente al global para el mismo mes. La vista global usa presupuestos globales para no sumar límites superpuestos.

Un ciclo cerrado usa el presupuesto del mes de inicio; no se excluye por terminar en ese mismo mes. La selección de tres ciclos toma los meses desde el inicio de ese rango (hasta tres meses), sin duplicar el mismo presupuesto cuando dos nóminas comparten mes. Sigue siendo presupuesto mensual, no un nuevo presupuesto independiente por cada nómina.

El gasto se clasifica con las categorías del presupuesto del mes correspondiente; en un único ciclo se usa el presupuesto seleccionado como referencia. Sin categoría configurada se respeta la marca fijo/variable. Las categorías del bloque ahorro se muestran en ese bloque, separadas del tope fijo+variable+extra.

Los pagos recurrentes solo son previsiones. No generan gastos reales. La próxima fecha se proyecta desde la fecha original, conservando el día cuando existe (31 de enero no queda convertido permanentemente en día 28).

## Objetivos

Se une por id el conjunto detectado por categoría y las asociaciones manuales. No se cuenta dos veces por tener ambos orígenes. Se aplican usuario, cuenta y rango; los objetivos personalizados respetan sus fechas.

Las aportaciones de ahorro son magnitudes positivas de salidas asociadas; no se usa el resultado general de ingresos menos gastos como sustituto del progreso. Una transferencia cuenta solo tras asociación manual con inclusión explícita, una vez por grupo. Reembolsos relacionados reducen el progreso por caja, incluidos gastos asociados manualmente de periodos anteriores.

La tarjeta agregada toma objetivos activos de tipo Ahorro; filtra sus cuentas/categorías y asociaciones, y admite la categoría Ahorro dentro de su ámbito. Los objetivos anuales se prorratean a meses para un dashboard filtrado; los personalizados mantienen su objetivo completo. Si hay varios objetivos que comparten una operación, cada objetivo individual puede mostrarla, pero la tarjeta agregada la cuenta una sola vez.

## Importaciones y duplicados

Identidad por usuario/cuenta, día contable UTC, céntimos y descripción normalizada sin acentos/puntuación. Las referencias bancarias y el saldo, cuando están en ambos archivos, distinguen operaciones. Se usa multiplicidad: dos compras idénticas siguen siendo dos, y reimportarlas no crea cuatro.

Sin referencia ni saldo no es posible distinguir matemáticamente una operación nueva idéntica de una copia solapada. Diferencias sustanciales de descripción PDF/CSV pueden seguir sin emparejarse: revisar la vista previa. La herramienta no inventa coincidencias aproximadas que borren pagos legítimos.

Fechas imposibles y filas incompletas se rechazan. El día ISO conserva la fecha contable, no la desplaza por zona horaria. La confianza alta necesita evidencia de saldos declarados y consistencia; no basta inferir el saldo inicial desde la primera fila. Confirmar/cancelar/eliminar se serializa por cuenta, sin guardados parciales ni repetición por doble clic.
