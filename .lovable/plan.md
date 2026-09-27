# Simplificar los avisos de Parts Orders

## Cambios
- Retirar del calendario la ventana flotante de piezas por ordenar.
- Retirar del calendario los avisos de piezas por ordenar que aparecen arriba.
- Mostrar junto a **Parts Orders** en el menú principal un contador con la cantidad de piezas pendientes.
- Incluir el contador tanto en el menú lateral como en el menú móvil.

## Regla del contador
Contará piezas activas que todavía requieren acción: **Needs ordering**, **Ordered**, **Partially received** o **Backordered**. No contará piezas **Arrived** ni **Cancelled**.

## Verificación
- Confirmar que el calendario ya no muestra ninguno de los dos recordatorios.
- Confirmar que el contador se actualiza al cambiar el estado de una pieza.
- Revisar el menú en escritorio y móvil.
