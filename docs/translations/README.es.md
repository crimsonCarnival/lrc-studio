# Syncify — LRC Editor

Una aplicación web profesional para sincronizar letras de canciones con audio, con soporte para sincronización por palabras estilo karaoke, contenido multilingüe, proyectos en la nube, y mucho más.

**[syncify-lrc.vercel.app](https://syncify-lrc.vercel.app)** · [GitHub](https://github.com/crimsonCarnival/lrc-editor) · [Documentación (DeepWiki)](https://deepwiki.com/crimsonCarnival/lrc-editor)

> Idiomas: [English (Inglés)](../../README.md) • [日本語 (Japonés)](README.ja.md)

## Tabla de Contenidos

- [Características](#características)
  - [Fuentes de Audio](#-fuentes-de-audio)
  - [Editor de Modos](#editor-de-modos)
  - [Tiempos y Sincronización](#tiempos-y-sincronización)
  - [Contenido de la Letra](#contenido-de-la-letra)
  - [Importación](#importación)
  - [Exportación](#exportación)
  - [Vista Previa en Vivo](#vista-previa-en-vivo)
  - [Gestión de Proyectos](#gestión-de-proyectos)
  - [Compartir](#compartir)
  - [Atajos de Teclado](#️-atajos-de-teclado)
  - [Interfaz y Temas](#interfaz-y-temas)
  - [Paneles de Configuración](#paneles-de-configuración)
  - [Autenticación](#autenticación)
- [Pila Tecnológica](#pila-tecnológica)
- [Empezando](#empezando)
  - [Prerrequisitos](#prerrequisitos)
  - [Instalación](#instalación)
  - [Scripts Disponibles](#scripts-disponibles)
- [Referencia de Formato de Archivo LRC](#referencia-de-formato-de-archivo-lrc)
  - [LRC Estándar](#lrc-estándar)
  - [Enhanced LRC (Nivel de palabra)](#enhanced-lrc-nivel-de-palabra)
  - [Con Secundario / Furigana](#con-secundario--furigana)
- [Licencia](#licencia)

## Características

### Fuentes de Audio

- **Archivos Locales** — Arrastra y suelta o busca para cargar MP3, WAV, FLAC, OGG y otros formatos comunes. Visualización completa de forma de onda con controles de búsqueda y bucle.
- **YouTube** — Pega cualquier URL de YouTube para transmitir el audio directamente dentro del editor. Incluye un indicador de progreso de reproducción visual con soporte de bucle A-B.
- **Spotify** — Conecta tu cuenta de Spotify Premium vía OAuth para cargar y reproducir pistas del catálogo de Spotify directamente en el editor.

### Editor de Modos

- **Modo LRC** — Sincronización línea por línea con marcas de tiempo precisas a milisegundos. Presiona una tecla configurable (por defecto: `Espacio`) para estampar la posición de reproducción actual en la línea activa.
- **Modo SRT** — Formato de subtítulos con tiempos de inicio y fin por línea. Cada línea recibe una marca de tiempo de entrada y salida para una colocación precisa de los subtítulos.
- **Modo Palabras** — Sincronización de karaoke por palabra. Cada palabra en una línea recibe su propia marca de tiempo independiente, permitiendo la reproducción animada del relleno de karaoke en la vista previa.

### Tiempos y Sincronización

- **Estampado por teclado** — Teclas de acceso rápido totalmente configurables para marcar, empujar y navegar por líneas durante las sesiones de sincronización.
- **Ajuste fino (Nudging)** — Desplaza las marcas de tiempo hacia adelante o hacia atrás por incrementos configurables (por defecto: 0.1s / 0.01s fino).
- **Desplazamiento en bloque** — Selecciona múltiples líneas y desplaza sus marcas de tiempo simultáneamente.
- **Desplazamiento global** — Desplaza todas las marcas de tiempo a la vez.
- **Bucle A-B** — Establece puntos de inicio y fin de bucle en la forma de onda o la barra de progreso para practicar una sección repetidamente.
- **Pausa automática al marcar** — Opcionalmente pausa la reproducción automáticamente después de estampar una línea.
- **Detección de superposición de marcas de tiempo** — Una insignia visual advierte cuando dos líneas comparten la misma marca de tiempo.

### Contenido de la Letra

- **Letras secundarias** — Añade una pista de texto secundario por línea (ej. romaji, pronunciación en idioma alternativo).
- **Capa de traducción** — Un campo de traducción por línea separado (ej. traducción al español junto a letras japonesas).
- **Furigana / Marcado Ruby** — Anota caracteres CJK con lecturas usando la sintaxis `{字|じ}`. El editor renderiza el marcado ruby sobre el carácter en línea.
- **Tokenización adaptada a CJK** — El texto en japonés, chino y coreano se divide automáticamente carácter por carácter para tiempos por carácter; las secuencias latinas se mantienen como tokens de palabra completa.
- **Formato de lectura** — Alterna entre Hiragana y Katakana para la visualización de lectura fonética.
- **Visualización de doble línea** — Opcionalmente muestra la siguiente línea debajo de la línea activa durante la sincronización para mejorar la legibilidad.

### Importación

- **Pegar / Escribir** — Ingresa letras directamente en la entrada de texto del editor.
- **Importar archivo** — Carga archivos existentes `.lrc`, `.srt` o `.txt`. El LRC a nivel de palabra (Enhanced LRC) también es compatible y preserva las marcas de tiempo por palabra.
- **Importar URL** — Importa letras desde un URL remoto a través del panel de importación.
- **Detección de pegado** — Al pegar un bloque LRC o SRT en el editor se detecta y analiza automáticamente.

### Exportación

- **Descarga LRC** — Formato estándar `[MM:SS.xx]` con marcas de tiempo por palabra opcionales (`<MM:SS.xx>`).
- **Descarga SRT** — Formato `HH:MM:SS,ms --> HH:MM:SS,ms` con contenido secundario opcional en la segunda línea.
- **Copiar al portapapeles** — Copia instantáneamente la salida LRC o SRT compilada.
- **Etiquetas de metadatos LRC** — Opcionalmente incluye etiquetas de cabecera `[ti:]`, `[ar:]`, `[al:]`, `[lg:]`.
- **Precisión configurable** — Elige precisión de centésimas (`[01:23.45]`) o milésimas (`[01:23.456]`) para marcas de tiempo de líneas y palabras.
- **Saltos de línea** — Selecciona LF o CRLF para compatibilidad con diferentes reproductores multimedia.
- **Eliminar líneas vacías** — Omite automáticamente las líneas no sincronizadas o en blanco de la salida.
- **Normalizar marcas de tiempo** — Ordena y desduplica marcas de tiempo al exportar.
- **Patrón de nombre de archivo** — Exporta archivo con el nombre `lyrics.lrc` (fijo) o derivado del título del proyecto (basado en medios).
- **Alternadores de traducción y secundario** — Elige si deseas incluir la pista secundaria y/o las traducciones en el archivo exportado.
- **Compilación de servidor con respaldo local** — La exportación compila en el servidor para formato avanzado; retrocede automáticamente al compilador local si el servidor no está disponible.

### Vista Previa en Vivo

- **Vista previa de karaoke en tiempo real** — El panel de vista previa resalta la línea actual en reproducción y rellena palabras carácter por carácter a medida que se reproducen (en el modo Palabras).
- **Suavizado de relleno de karaoke** — Elige entre lineal (preciso) y de aceleración/desaceleración (suave) para la animación del relleno de palabras.
- **Selección de pista de relleno** — Aplica el relleno animado al texto principal, texto secundario o a ambos.
- **Visualización de traducción** — Opcionalmente muestra la capa de traducción debajo de cada línea de letra en la vista previa.
- **Visualización de furigana** — Alterna las anotaciones de texto ruby visibles en la vista previa.
- **Tamaño de fuente** — Cuatro ajustes preestablecidos de tamaño: Pequeño, Normal, Grande, Extra Grande.
- **Espaciado de línea** — Espaciado compacto, normal o relajado entre líneas.
- **Alineación de la vista previa** — Alineación a la izquierda, centrada o a la derecha.
- **Desplazamiento automático** — Desplaza automáticamente la línea activa a la vista; alineación configurable (centro, superior, más cercano, apagado) y comportamiento de desplazamiento (suave / instantáneo).

### Gestión de Proyectos

- **Biblioteca de proyectos** — Navega, busca y gestiona todos tus proyectos. Cada proyecto almacena letras, marcas de tiempo, referencias multimedia y el estado del editor.
- **Sincronización en la nube** — Los usuarios autenticados tienen sus proyectos guardados en el servidor automáticamente. Los proyectos se crean al guardar por primera vez y se parchean incrementalmente por eficiencia.
- **Autoguardado** — El autoguardado de doble condición se dispara después de un intervalo de tiempo configurable o después de 5 ediciones de líneas, lo que ocurra primero.
- **Guardado manual** — Botón de guardar con indicador de estado de autoguardado (rueda de carga → marca de verificación).
- **Respaldo de almacenamiento local** — Todos los datos del proyecto también se reflejan en el `localStorage` para que el trabajo nunca se pierda sin conexión.
- **Biblioteca de subidas** — Visualiza todos los archivos de audio y las pistas de YouTube/Spotify previamente asociadas a los proyectos.
- **Visor de proyectos compartidos** — Abre una vista de solo lectura de un proyecto compartido con su contenido multimedia integrado y letras sincronizadas.
- **Metadatos del proyecto** — Almacena nombre del proyecto, descripción y etiquetas.

### Compartir

- **Compartir de forma pública/privada** — Genera una URL para compartir para cualquier proyecto. Alterna la visibilidad entre pública (cualquiera con el enlace) y privada (solo el propietario).
- **Enlace profundo con marca de tiempo** — Incluye un parámetro de consulta `?s=N` en la URL para iniciar la reproducción en un segundo específico.
- **Atajo para posición actual** — Sincronización en un solo clic del parámetro de la marca de tiempo a la posición de reproducción actual de forma compartida.

### ⌨️ Atajos de Teclado

Todos los atajos de teclado son totalmente configurables a través de **Configuración → Atajos**.

| Acción | Atajo por Defecto |
|---|---|
| **Atajos del Editor** | |
| Estampar / Marcar | `Espacio` |
| Desplazar a la Izquierda (restar tiempo) | `Alt+FlechaIzquierda` |
| Desplazar a la Derecha (sumar tiempo) | `Alt+FlechaDerecha` |
| Añadir Línea | `Ctrl+Enter` |
| Eliminar Línea | `Suprimir` |
| Borrar Marca de Tiempo | `Retroceso` |
| Cambiar Modo (LRC/SRT) | `Ctrl+M` |
| Deseleccionar / Cerrar | `Escape` |
| Mostrar Ayuda de Atajos | `?` |
| Seleccionar un Rango | `Shift + Clic` |
| Elegir Líneas Individuales | `Ctrl + Clic` |
| **Atajos del Reproductor** | |
| Reproducir / Pausar | `Enter` |
| Buscar Atrás | `FlechaIzquierda` |
| Buscar Adelante | `FlechaDerecha` |
| Silenciar / Anular Silencio | `m` |
| Aumentar Velocidad | `+` |
| Disminuir Velocidad | `-` |
| **Atajos de Vista Previa** | |
| Alternar Traducciones | `t` |
| Añadir Letras Secundarias | `Shift+H` |
| Añadir Traducciones | `Shift+T` |

### Interfaz y Temas

- **Temas** — Oscuro, Claro, Dracula, Alucard, Alucard Claro, Sistema (sigue la preferencia del OS).
- **Estilos de resaltado de línea activa** — Brillo, Zoom, Color o Tenue.
- **Diseño de Traducción** — Apilado (traducción bajo la letra) o Lado a lado.
- **Modo Enfoque** — Oculta el panel del editor para una vista previa sin obstrucciones.
- **Paneles redimensionables** — Arrastra el divisor entre el editor y la vista previa para ajustar el ancho.
- **Bloquear diseño** — Previene el cambio de tamaño accidental de los paneles.
- **Diseño móvil** — Navegación móvil mediante pestañas entre paneles del reproductor, editor y vista previa.
- **Internacionalización** — Interfaz completa disponible en **Inglés** y **Español** (se pueden agregar más a través de la carpeta `/locales`).

### Paneles de Configuración

La aplicación es altamente personalizable a través del modal de Configuración. Las configuraciones están agrupadas en paneles lógicos:

**Editor**
- **Modo de Editor por Defecto**: LRC o SRT.
- **Mostrar Marcas de Tiempo de Palabra**: Alternar visibilidad de las marcas de tiempo a nivel de palabra `<MM:SS.xx>` en el editor.
- **Autoseleccionar Siguiente Línea**: Avanzar la selección automáticamente después de estampar.
- **Modo de Resaltado**: Controla cómo se resalta la línea activa.
- **Selección de Bucle**: Bucle automático del audio delimitado por las líneas seleccionadas.
- **Pausa al Marcar**: Pausa la reproducción inmediatamente después de estampar una línea.
- **Ajustes de Desplazamiento**: Configura la cantidad de tiempo aplicada por la acción "Desplazar Todos" y el desplazamiento de ajuste predeterminado (ej., 0.1s).

**Reproducción**
- **Tiempo de Búsqueda**: Segundos para avanzar/retroceder al realizar la búsqueda (por defecto 5s).
- **Velocidad Predeterminada**: Configura multiplicadores de velocidad de reproducción (0.5× a 1.5×, o personalizado).
- **Control de Volumen**: Deslizador de volumen persistente con alternancia de silencio.

**Interfaz**
- **Tema**: Oscuro, Claro, Dracula, Alucard, Alucard Claro o Sistema.
- **Idioma**: Inglés o Español.
- **Resaltado de Línea Activa**: Brillo, Zoom, Color o Tenue.
- **Comportamiento de Desplazamiento**: Suave o Instantáneo.
- **Alineación de Desplazamiento**: Centro, Cercano, Arriba o Apagado.
- **Alineación de Vista Previa**: Izquierda, Centro o Derecha.
- **Tipografía**: Ajusta el tamaño de fuente (Pequeño a Extra Grande) y espaciado de línea (Compacto a Relajado).
- **Diseño de Traducción**: Vista Lado a lado o Apilada.
- **Relleno de Karaoke**: Personaliza la pista de relleno (Principal, Secundaria o Ambas) y la función de transición (Lineal o Aceleración/Desaceleración).
- **Formato de Lectura**: Muestra anotaciones ruby como Hiragana o Katakana.
- **Bloquear Diseño**: Previene redimensionamiento accidental de los paneles del editor.

**Exportación**
- **Formatos**: Formatos por defecto para copiar y descargar (LRC o SRT).
- **Precisión de Marcador**: Centésimas (por defecto) o Milésimas tanto para marcas de tiempo de líneas como de palabras.
- **Patrón de Nombre de Archivo**: Fijo (`lyrics.lrc`) o derivado del Título del Medio.
- **Opciones de Formateo**: Finales de línea de Windows (CRLF) o Unix (LF), omitir líneas vacías, normalizar marcas de tiempo e incluir etiquetas de metadatos.

**Atajos**
- Configura las 18 combinaciones de teclas y modificadores del ratón a través de los espacios de nombres del Editor, Reproductor y Vista Previa. Incluye detección de conflictos incorporada.

**Avanzado**
- **Autoguardado**: Alterna el autoguardado y configura el intervalo (10 a 300 segundos).
- **Zona Horaria**: Autodetecta o establece manualmente la zona horaria utilizada para capturas en el servidor.

**Conexiones y Perfil**
- Gestiona vinculación vía OAuth de Spotify, actualiza tu nombre para mostrar/avatar, y cambia tu contraseña de cuenta.

### Autenticación

- **Registro de cuenta e inicio de sesión** — Autenticación por correo/contraseña.
- **Spotify OAuth** — Conecta/desconecta cuenta de Spotify para hacer streaming de pistas.
- **Página de perfil** — Ve y actualiza nombre a mostrar, avatar y detalles de cuenta. Solo para futura implementación.
- **Tablero de administración** — Administra usuarios y contenido (solo rol de administrador). Solo para futura implementación.

---

## Pila Tecnológica

| Capa | Tecnología |
|---|---|
| Framework | [React 19](https://react.dev/) |
| Herramienta de Construcción | [Vite 8](https://vitejs.dev/) |
| Estilos | [Tailwind CSS v4](https://tailwindcss.com/) |
| Animaciones | [Framer Motion](https://www.framer.com/motion/) |
| Forma de Onda de Audio | [WaveSurfer.js](https://wavesurfer-js.org/) |
| Componentes UI | [Radix UI](https://www.radix-ui.com/) |
| Internacionalización | [i18next](https://www.i18next.com/) |
| Enrutamiento | [React Router v7](https://reactrouter.com/) |
| Virtualización | [TanStack Virtual](https://tanstack.com/virtual) |

---

## Empezando

### Prerrequisitos

- Node.js v18 o superior
- npm

### Instalación

1. Clona el repositorio:

   ```bash
   git clone https://github.com/crimsonCarnival/lrc-editor.git
   cd lrc-editor
   ```

2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Configura el entorno:

   ```bash
   cp .env.example .env
   # Edita .env y establece VITE_API_URL hacia tu servidor backend
   ```

4. Inicia el servidor de desarrollo:

   ```bash
   npm run dev
   ```

5. Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

### Scripts Disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo de Vite |
| `npm run build` | Compila el paquete de producción |
| `npm run preview` | Previsualiza la compilación de producción localmente |
| `npm run lint` | Ejecuta ESLint |

---

## Referencia de Formato de Archivo LRC

### LRC Estándar

```lrc
[ti:Song Title]
[ar:Artist Name]
[al:Album Name]
[00:10.50]First line of lyrics
[00:15.20]Second line of lyrics
```

### Enhanced LRC (Nivel de palabra)

```lrc
[00:10.50]<00:10.50>Hold <00:11.00>me <00:11.40>close
[00:15.20]<00:15.20>Don't <00:15.80>let <00:16.10>go
```

### Con Secundario / Furigana

Múltiples líneas compartiendo una marca de tiempo se apilan verticalmente en reproductores compatibles:

```lrc
[00:10.50]持ち上げて
[00:10.50]mochiagete
[00:10.50]Lift me up
```

---

## Licencia

Este proyecto es de código abierto y está disponible bajo la Licencia MIT.
