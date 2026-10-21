# Catálogo Dos Solcitos

## Imágenes de Google Drive

- Columna `foto`/`imagen` de la hoja: pegá el link de Drive. Se aceptan `/file/d/<id>/view`, `open?id=<id>` y `uc?id=<id>`.
- Formato recomendado: `https://drive.google.com/uc?export=view&id=FILE_ID`. El catálogo convierte cualquier link común a este formato.
- El archivo debe estar compartido como "Cualquiera con el enlace" (también los de subcarpetas; los permisos de la carpeta madre se heredan salvo que se cambien).
- **Cache-busting:** se agrega `&v=<valor>` al link para que el navegador no muestre la versión vieja cuando reemplazás la foto con el mismo ID. Por defecto `v` es el momento de carga del catálogo; si la hoja tiene una columna opcional `actualizado` (fecha o número), se usa ese valor. Las imágenes que no son de Drive no se modifican.
- **Refrescar:** si reemplazás el archivo manteniendo el ID, recargá la página (o cambiá `actualizado`). Si borrás y subís uno nuevo, el ID cambia: actualizá el link en la hoja. El catálogo lee los links de la hoja, no recorre carpetas de Drive, por lo que las subcarpetas no requieren indexado.
