# Guía de Despliegue y Uso en GitHub Pages (PWA) — AetherWeaver

Esta guía reúne todo el proceso paso a paso para publicar **AetherWeaver** en **GitHub Pages**, probarlo en tu PC, instalarlo como una aplicación nativa (PWA) en el celular Android de tu esposa y cómo publicar actualizaciones futuras sin que ella pierda sus datos.

---

## 🛡️ Seguridad y Privacidad

En las cuentas gratuitas de GitHub, los repositorios que usan GitHub Pages deben ser **públicos**. Esto es **100% seguro** para tu caso de uso por dos razones fundamentales:

1. **Tu archivo `.env` nunca se sube a internet:** El archivo `.gitignore` del proyecto bloquea automáticamente `.env`, logs y carpetas de prueba. Tu token maestro nunca saldrá de tu computadora.
2. **Los datos residen únicamente en el teléfono:** Los personajes creados, conversaciones, imágenes generadas y el API Token que tu esposa ingrese en su celular se guardan **de forma exclusiva y privada en el almacenamiento local de su navegador (`localStorage`)**. Nada de eso viaja a GitHub ni a servidores de terceros (solo se comunica de forma directa y cifrada con la API de NovelAI).

---

## Fase 1: Publicar el proyecto en GitHub Pages

### Paso 1.1: Crear el repositorio en GitHub
1. Abre tu navegador e inicia sesión en [GitHub.com](https://github.com).
2. Arriba a la derecha, haz clic en el botón con el signo **`+`** y selecciona **New repository**.
3. Asigna un nombre al repositorio (por ejemplo: `aetherweaver` o `husbando`).
4. Selecciona la opción **Public** (necesaria en cuentas gratuitas para usar Pages).
5. **No** marques las opciones *"Add a README"*, *".gitignore"* ni *"license"* (ya las tenemos creadas en la carpeta de tu computadora).
6. Haz clic en el botón verde **Create repository**.

---

### Paso 1.2: Subir el código desde tu PC
Abre PowerShell o tu terminal en la carpeta del proyecto (`g:\Project Husbando`) y ejecuta los siguientes comandos en orden (reemplaza `TU_USUARIO` y `TU_REPOSITORIO` por los nombres de tu cuenta y repositorio de GitHub):

```powershell
# 1. Inicializar git en la carpeta
git init -b main

# 2. Agregar todos los archivos (el .gitignore excluirá automáticamente .env y archivos temporales)
git add .

# 3. Crear el primer commit
git commit -m "Version inicial lista para GitHub Pages PWA"

# 4. Vincular con tu repositorio en GitHub
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git

# 5. Subir el código a GitHub
git push -u origin main
```

---

### Paso 1.3: Activar GitHub Pages en el repositorio
1. En GitHub, dentro de la página de tu repositorio recién creado, haz clic en la pestaña superior **Settings** (ícono de engranaje ⚙️).
2. En la columna de navegación izquierda, busca y selecciona **Pages**.
3. En la sección **Build and deployment**:
   - **Source:** Asegúrate de que esté seleccionado `Deploy from a branch`.
   - **Branch:** Selecciona `main` y deja la carpeta en `/(root)`.
4. Haz clic en el botón **Save**.
5. Espera entre 60 y 90 segundos. Al recargar la página verás un recuadro verde con la dirección web de tu app:
   > **URL pública:** `https://TU_USUARIO.github.io/TU_REPOSITORIO/`

---

## Fase 2: Cómo hacer tus pruebas (en PC o Celular)

Antes de entregarle el enlace a tu esposa, haz una prueba para verificar que el sitio funciona de forma 100% independiente (sin depender del servidor local `proxy.mjs` de tu PC):

1. Abre una **pestaña de incógnito** en Google Chrome, Edge o Firefox.
2. Ingresa a la URL de GitHub Pages: `https://TU_USUARIO.github.io/TU_REPOSITORIO/`
3. Abre el menú lateral y haz clic en **Ajustes** (ícono de engranaje ⚙️):
   - En **Active Provider**, verifica que esté seleccionado `NovelAI API (Direct / Local Proxy)`.
   - En **NovelAI API Token**, pega tu token de NovelAI (comienza con `pst-...`).
   - Haz clic en **Save Preferences**.
4. **Prueba de chat:**
   - Entra a la conversación con cualquier personaje y envíale un mensaje.
   - Observa cómo NovelAI responde en streaming directamente en el navegador.
5. **Prueba de imagen:**
   - Toca el botón de generar imagen o genera un avatar en la edición de un personaje.
   - El sistema se conectará a NovelAI, descargará el paquete y mostrará la imagen generada.

---

## Fase 3: Instrucciones para tu esposa (Celular Android)

Tu esposa solo debe realizar este proceso **una sola vez**:

### 1. Abrir el enlace
- Pásale la URL de GitHub Pages por WhatsApp o mensaje (ej: `https://TU_USUARIO.github.io/TU_REPOSITORIO/`).
- Ella debe abrir el enlace utilizando **Google Chrome** en su teléfono Android.

### 2. Instalar la aplicación (PWA)
- En la parte inferior de la pantalla aparecerá un mensaje automático: *"Agregar AetherWeaver a la pantalla principal"* o *"Instalar aplicación"*.
- Si no aparece el aviso automático:
  1. Ella toca el botón de **tres puntos verticales (`⋮`)** en la esquina superior derecha de Chrome.
  2. Selecciona la opción **"Instalar aplicación"** (o *"Agregar a pantalla principal"*).
  3. Confirma tocando **Instalar**.

### 3. Abrir la App instalada
- En la pantalla de inicio o cajón de aplicaciones de su celular aparecerá el ícono de **AetherWeaver**.
- Al tocarlo, la aplicación se abrirá en modo de **pantalla completa**, sin barra de direcciones, luciendo y funcionando igual que cualquier app nativa descargada de la Play Store.

### 4. Configurar el Token de NovelAI (Solo una vez)
- Dentro de la app, ir a **Ajustes** (ícono de engranaje ⚙️).
- Pegar el token de NovelAI en la casilla **NovelAI API Token**.
- Tocar **Save Preferences**.
- ¡Listo! A partir de ese momento puede chatear, crear nuevos personajes y generar imágenes con total libertad.

---

## Fase 4: Cómo publicar una Actualización en el futuro

Cuando hagas cambios en el diseño, agregues nuevas opciones o mejores los prompts:

### Paso 4.1: Incrementar la versión de caché (Recomendado)
Abre el archivo `sw.js` y sube el número de versión en la línea 5:
```javascript
// Si estaba en v8, cámbialo a v9:
const CACHE_NAME = 'aetherweaver-shell-v9';
```
*(Esto le indica a los navegadores y teléfonos que hay una versión nueva lista para descargar).*

### Paso 4.2: Subir los cambios a GitHub
En tu terminal:
```powershell
git add .
git commit -m "Mejora: descripcion del cambio realizado"
git push
```
En aproximadamente 1 minuto, GitHub Pages publicará la nueva versión.

### ¿Qué ocurrirá en el teléfono de tu esposa?
- **Actualización transparente:** La próxima vez que ella abra la app teniendo conexión a internet, el Service Worker detectará los archivos nuevos, los descargará en segundo plano y se actualizará automáticamente.
- **¿Pierde sus personajes o chats? ¡NO!:** Las conversaciones, personajes creados y ajustes viven de forma independiente en la memoria privada (`localStorage`) del celular. Las actualizaciones de código solo renuevan los archivos de la app (HTML/CSS/JS), nunca tocan los datos guardados.
- **Respaldo adicional de seguridad:** Si alguna vez cambia de celular o quiere hacer una copia de seguridad manual, en **Ajustes** tiene el botón **"Export All Data (JSON)"** para descargar un archivo con toda su información, el cual puede restaurar en cualquier momento con **"Import Backup (JSON)"**.

---

## ❓ Preguntas Frecuentes y Solución de Problemas

#### ¿Por qué sale un error 401 al intentar chatear?
El token ingresado en Ajustes es incorrecto o ha expirado. Vuelve a copiar el token desde la web de NovelAI (`Account Settings` -> `Access Tokens`) e ingrésalo en los Ajustes de la app.

#### ¿La app consume datos de mi plan de GitHub?
No. GitHub Pages ofrece 100 GB de transferencia mensual gratuita. Una aplicación como esta, al ser un archivo ligero que se guarda en el teléfono, consume una fracción ínfima de ese límite.

#### ¿Puedo seguir usando `start.bat` y `proxy.mjs` en mi PC?
Sí, totalmente. El código detecta automáticamente dónde se ejecuta:
- Si estás en tu PC (`http://127.0.0.1:8787/`), usará el servidor proxy local.
- Si estás en GitHub Pages (`https://...github.io`), se conectará directamente a las APIs de NovelAI.
