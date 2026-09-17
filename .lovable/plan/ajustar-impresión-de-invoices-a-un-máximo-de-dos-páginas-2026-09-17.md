# Ajustar impresión de invoices a un máximo de dos páginas

## Objetivo
Usar la invoice 1028 como caso de prueba y aplicar una sola regla a todas las invoices existentes y futuras:
- Si cabe a tamaño normal, imprimir en una página.
- Si necesita más espacio, permitir dos páginas manteniendo el tamaño normal.
- Solo si excede dos páginas, reducir automáticamente toda la invoice hasta que quepa exactamente dentro de dos páginas.
- Eliminar el cuadrado negro visible al final de la vista previa.

## Cambios
- Corregir la medición para calcular el contenido real sin contar el alto artificial usado para completar páginas.
- Aplicar la escala automática antes de mostrar o imprimir, sin reducir invoices de una o dos páginas.
- Asegurar que la hoja termine en un límite válido de una o dos páginas y que nunca genere una tercera página vacía.
- Quitar fondos, pseudo-elementos o desbordes que puedan producir el cuadrado negro.
- Mantener los márgenes A4 actuales y hacer que vista previa e impresión usen la misma escala.

## Verificación
- Abrir la invoice 1028 y comprobar visualmente la vista previa.
- Confirmar el número calculado de páginas y ausencia del cuadrado negro.
- Probar una invoice corta y una larga para confirmar la regla 1 página / máximo 2 páginas.
