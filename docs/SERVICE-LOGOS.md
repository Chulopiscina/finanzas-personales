# Logos de servicios

Los archivos de `public/service-logos/` son imagenes originales de las marcas,
descargadas el 26 de octubre de 2026. No se dibujan imitaciones ni se cambian sus
colores. `src/lib/service-brands.json` registra fuente, pagina oficial y titular.

- Netflix: icono publicado en su propia web.
- Spotify: simbolo del kit de prensa oficial.
- Disney+, Movistar, Google One, ChatGPT y Synergym: iconos publicados por sus
  respectivos titulares en el App Store de Apple, con editor verificado.
- DIGI: icono publicado en su propia web.

Se usan para identificar el servicio de un pago, sin implicar afiliacion.
Las marcas e imagenes pertenecen a sus respectivos titulares.

## Privacidad y mantenimiento

Los navegadores solo solicitan imagenes locales. Nunca se envia un nombre de
pago, cuenta, usuario o concepto a un buscador de logos o servicio de favicons.
Si el nombre no coincide de forma inequivoca, se muestran sus iniciales.

Para incorporar otro servicio: obtener su imagen oficial, registrar su fuente,
anadir una regla exacta en `service-brands.ts` y sus pruebas. No utilizar la
categoria para adivinar el proveedor. No deformar, recolorear ni recrear logos.

## Calendario

El widget del Dashboard reutiliza pagos activos de la consulta existente, sin
nuevas consultas ni cambios de esquema. El mes se cambia dentro del widget y la
cuenta conserva el filtro del Dashboard. Planificacion conserva el formulario
y todas las acciones de gestion; ya no contiene un calendario independiente.

Los vencimientos son previsiones, no cobros confirmados. Una fecha pasada no
demuestra un pago: se muestra "Sin confirmar", nunca "Pagado" automaticamente.
No se hacen conciliaciones nuevas ni se alteran importes o movimientos.
